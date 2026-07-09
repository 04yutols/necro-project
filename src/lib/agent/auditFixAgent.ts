/**
 * Agent B: 監査修正エージェント。
 *
 * 監査 FAIL を持つ既存エンティティを、最小変更で修正する。
 * 二層ゲートで検証する:
 *   1. per-content バリデータ（scope別・詳細）… scopeRegistry 経由
 *   2. in-memory 監査（auditFn）… 対象 FAIL の解消 + 新規 FAIL を生んでいないか
 * いずれかが不合格なら再生成（最大 maxAttempts）。
 *
 * 監査関数は呼び出し側（Server Action）から注入する（lib を 'use server' 非依存に保つ）。
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { thinkingBudgetForAttempt, JSON_OUTPUT_RESERVE } from './thinkingBudget';
import { deepDiff, type FieldDiff } from './auditFix/diff';
import { getScopeEntry, type MasterData, type ScopeValidationResult } from './auditFix/scopeRegistry';

export type AuditFinding = { level: string; scope: string; id: string; message: string };

/** in-memory 監査関数（auditMasterData をバインドして渡す）。 */
export type AuditFn = (override: Record<string, Record<string, Record<string, unknown>>>) => Promise<AuditFinding[]>;

export type AuditFixInput = {
  scope: string;
  entityId: string;
  /** 解消対象（この entity の FAIL）。 */
  findings: AuditFinding[];
  /** 現在のエンティティ JSON。 */
  currentEntity: Record<string, unknown>;
  /** マスターデータ全体（プレーン record）。 */
  all: MasterData;
  /** 注入される in-memory 監査関数。 */
  auditFn: AuditFn;
  /** パッチ前の全 FAIL キー集合（"scope|id|message"）。新規 FAIL 検出に使う。 */
  baselineFailKeys: Set<string>;
  maxAttempts?: number;
  model?: string;
};

export type AuditFixResult = {
  patched: Record<string, unknown> | null;
  diff: FieldDiff[];
  /** per-content バリデータ結果。 */
  perContent: ScopeValidationResult | null;
  /** 監査ゲート結果。 */
  audit: { resolved: boolean; remainingTargetFails: AuditFinding[]; newFails: AuditFinding[] } | null;
  ok: boolean;
  attempts: number;
  log: string[];
  error?: string;
};

function failKey(f: AuditFinding): string {
  return `${f.scope}|${f.id}|${f.message}`;
}

const StateAnnotation = Annotation.Root({
  scope: Annotation<string>,
  entityId: Annotation<string>,
  findings: Annotation<AuditFinding[]>,
  currentEntity: Annotation<Record<string, unknown>>,
  all: Annotation<MasterData>,
  auditFn: Annotation<AuditFn>,
  baselineFailKeys: Annotation<Set<string>>,
  maxAttempts: Annotation<number>,
  model: Annotation<string>,
  patched: Annotation<Record<string, unknown> | null>({ reducer: (_p, n) => n, default: () => null }),
  perContent: Annotation<ScopeValidationResult | null>({ reducer: (_p, n) => n, default: () => null }),
  auditResult: Annotation<AuditFixResult['audit']>({ reducer: (_p, n) => n, default: () => null }),
  feedback: Annotation<string>({ reducer: (_p, n) => n, default: () => '' }),
  attempts: Annotation<number>({ reducer: (_p, n) => n, default: () => 0 }),
  log: Annotation<string[]>({ reducer: (p, n) => [...p, ...n], default: () => [] }),
  errorMsg: Annotation<string | undefined>({ reducer: (_p, n) => n, default: () => undefined }),
});

type State = typeof StateAnnotation.State;

function buildPrompt(state: State): string {
  const entry = getScopeEntry(state.scope);
  const refHint = entry ? entry.referenceHint(state.all) : '';
  const findingsList = state.findings.map((f) => `- ${f.message}`).join('\n');

  const base = `あなたは Necromance Brave のデータ修正担当です。以下のエンティティには検証違反があります。
指摘された違反【のみ】を最小限の変更で修正し、それ以外のフィールドは現状を維持してください。

# 対象（scope: ${state.scope} / id: ${state.entityId}）
${JSON.stringify(state.currentEntity, null, 2)}

# 検出された違反（すべて解消すること）
${findingsList}

# 参照可能なID（参照切れはこの中の実在IDに差し替える。捏造禁止）
${refHint}

# 出力（修正後のエンティティ JSON のみ。説明文・マークダウン不要）
- 指摘されたフィールド以外は変更しない。
- 数値スケール・列挙・帯・参照は設計ルールに従う。
- id は変更しない（"${state.entityId}" のまま）。`;

  if (state.feedback) {
    return `${base}

# 前回の修正は以下の検証で不合格でした。必ず解消してください。
${state.feedback}`;
  }
  return base;
}

async function generateNode(state: State): Promise<Partial<State>> {
  const attempt = state.attempts + 1;
  const thinkingBudget = thinkingBudgetForAttempt(state.findings.map((f) => f.message).join(' '), attempt);
  const maxOutputTokens = thinkingBudget + JSON_OUTPUT_RESERVE + 2048;
  try {
    const patched = await generateJson<Record<string, unknown>>(buildPrompt(state), {
      model: state.model || DEFAULT_GEMINI_MODEL,
      temperature: state.feedback ? 0.3 : 0.5,
      thinkingBudget,
      maxOutputTokens,
    });
    // id は維持を強制
    patched.id = state.entityId in patched || patched.id ? patched.id : state.currentEntity.id;
    return {
      patched,
      attempts: attempt,
      log: [`修正案生成 #${attempt}（thinking ${thinkingBudget}）`],
    };
  } catch (e) {
    return {
      attempts: attempt,
      errorMsg: e instanceof Error ? e.message : String(e),
      log: [`修正案生成 #${attempt} 失敗: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

async function validateNode(state: State): Promise<Partial<State>> {
  if (!state.patched) return { log: ['検証スキップ: 修正案がありません'] };
  const entry = getScopeEntry(state.scope);
  if (!entry) {
    return { errorMsg: `未対応の scope: ${state.scope}`, log: [`未対応の scope: ${state.scope}`] };
  }

  // 層1: per-content バリデータ
  const ctx = entry.buildContext(state.all, state.entityId, state.patched);
  const perContent = entry.validate(state.patched, ctx);

  // 層2: in-memory 監査（パッチを override して全体検査）
  const auditFindings = await state.auditFn({ [state.scope]: { [state.entityId]: state.patched } });
  const remainingTargetFails = auditFindings.filter(
    (f) => f.level === 'FAIL' && f.scope === state.scope && f.id === state.entityId,
  );
  const newFails = auditFindings.filter(
    (f) => f.level === 'FAIL' && !state.baselineFailKeys.has(failKey(f)),
  );
  const auditResolved = remainingTargetFails.length === 0 && newFails.length === 0;

  const feedbackParts: string[] = [];
  if (!perContent.ok) {
    feedbackParts.push(
      perContent.findings.filter((f) => f.level === 'FAIL').map((f) => `- [${f.field}] ${f.message}`).join('\n'),
    );
  }
  if (remainingTargetFails.length > 0) {
    feedbackParts.push(remainingTargetFails.map((f) => `- [監査] ${f.message}`).join('\n'));
  }
  if (newFails.length > 0) {
    feedbackParts.push(
      '修正により新たな違反が発生しました（元に戻すか、参照を整合させてください）:\n' +
        newFails.map((f) => `- [${f.scope}/${f.id}] ${f.message}`).join('\n'),
    );
  }

  const pcFail = perContent.findings.filter((f) => f.level === 'FAIL').length;
  return {
    perContent,
    auditResult: { resolved: auditResolved, remainingTargetFails, newFails },
    feedback: feedbackParts.join('\n'),
    log: [
      `検証: per-content ${perContent.ok ? 'PASS' : `FAIL(${pcFail})`} / 監査 ${auditResolved ? 'PASS' : `未解消(${remainingTargetFails.length}) 新規(${newFails.length})`}`,
    ],
  };
}

function routeAfterValidate(state: State): 'regenerate' | typeof END {
  if (state.errorMsg) return END;
  const ok = (state.perContent?.ok ?? false) && (state.auditResult?.resolved ?? false);
  if (ok) return END;
  if (state.attempts >= state.maxAttempts) return END;
  return 'regenerate';
}

function createGraph() {
  return new StateGraph(StateAnnotation)
  .addNode('generate', generateNode)
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

export async function runAuditFixAgent(input: AuditFixInput): Promise<AuditFixResult> {
  const final = await getGraph().invoke({
    scope: input.scope,
    entityId: input.entityId,
    findings: input.findings,
    currentEntity: input.currentEntity,
    all: input.all,
    auditFn: input.auditFn,
    baselineFailKeys: input.baselineFailKeys,
    maxAttempts: input.maxAttempts ?? 3,
    model: input.model ?? DEFAULT_GEMINI_MODEL,
  });

  const diff = final.patched ? deepDiff(input.currentEntity, final.patched) : [];
  const ok = (final.perContent?.ok ?? false) && (final.auditResult?.resolved ?? false);

  return {
    patched: final.patched,
    diff,
    perContent: final.perContent,
    audit: final.auditResult,
    ok,
    attempts: final.attempts,
    log: final.log,
    error: final.errorMsg,
  };
}
