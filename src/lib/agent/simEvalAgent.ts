/**
 * Agent E: シミュレータ連携（バランス評価）エージェント。
 *
 * 決定論的に算出した SimulationReport を LLM が「読んで解釈」し、評定と調整推奨を返す。
 * LLM は計算しない（数値はレポートのもの）。生成ループは不要（検証付き生成ではなく解釈）。
 * 推奨値は recommendationCheck で設計帯チェックし、帯外に警告を付す。
 */

import { generateJson, DEFAULT_GEMINI_MODEL } from './gemini';
import { reportToText, type SimulationReport } from './sim/simulationReport';
import {
  checkRecommendations,
  type Recommendation,
  type RecCheckContext,
  type RecCheckResult,
} from './sim/recommendationCheck';

export type SimEvalInput = {
  report: SimulationReport;
  /** 設計帯コンテキスト（プロンプトに添える doc19/15 抜粋）。 */
  designContext: string;
  /** 推奨の帯チェック用コンテキスト。 */
  recCheckContext: RecCheckContext;
  model?: string;
};

export type SimEvaluation = {
  verdict: 'BALANCED' | 'TOO_STRONG' | 'TOO_WEAK';
  rationale: string;
  recommendations: Recommendation[];
};

export type SimEvalResult = {
  evaluation: SimEvaluation | null;
  /** 推奨の設計帯チェック結果（帯外警告を含む）。 */
  recChecks: RecCheckResult[];
  log: string[];
  error?: string;
};

const VALID_VERDICTS = ['BALANCED', 'TOO_STRONG', 'TOO_WEAK'];
const VALID_TARGETS = ['skill.power', 'skill.mpCost', 'enemy.hp', 'enemy.def'];

function buildPrompt(input: SimEvalInput): string {
  return `あなたは Necromance Brave のバランスデザイナーです。以下は実バトルと同一の計算式で算出した
シミュレーション結果（決定論的・確定値）です。この数値を解釈し、バランスを評定してください。
数値はあなたが計算したものではありません。与えられた数値のみを根拠にしてください。

# シミュレーション結果
${reportToText(input.report)}

# 設計帯（doc19/15）
${input.designContext}

# 出力（このJSONオブジェクトのみ。説明文やマークダウン不要）
{
  "verdict": "BALANCED | TOO_STRONG | TOO_WEAK",
  "rationale": "数値を引用した日本語の評定（2〜4文）",
  "recommendations": [
    { "target": "skill.power | skill.mpCost | enemy.hp | enemy.def", "current": 数値, "suggested": 数値, "reason": "短い理由" }
  ]
}

# 厳守
- 数値は与えられたものだけを使う（再計算・捏造しない）。
- 推奨は設計帯に収める。問題なければ verdict=BALANCED で recommendations は空配列 [] にする。
- recommendations の target は上記4種のみ。`;
}

function coerceEvaluation(raw: unknown): SimEvaluation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const verdict = typeof r.verdict === 'string' && VALID_VERDICTS.includes(r.verdict) ? (r.verdict as SimEvaluation['verdict']) : 'BALANCED';
  const rationale = typeof r.rationale === 'string' ? r.rationale : '';
  const recs: Recommendation[] = Array.isArray(r.recommendations)
    ? r.recommendations
        .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
        .filter((x) => typeof x.target === 'string' && VALID_TARGETS.includes(x.target))
        .map((x) => ({
          target: x.target as Recommendation['target'],
          current: typeof x.current === 'number' ? x.current : NaN,
          suggested: typeof x.suggested === 'number' ? x.suggested : NaN,
          reason: typeof x.reason === 'string' ? x.reason : undefined,
        }))
        .filter((x) => Number.isFinite(x.suggested))
    : [];
  return { verdict, rationale, recommendations: recs };
}

export async function runSimEvalAgent(input: SimEvalInput): Promise<SimEvalResult> {
  try {
    const raw = await generateJson<unknown>(buildPrompt(input), {
      model: input.model ?? DEFAULT_GEMINI_MODEL,
      temperature: 0.4,
      maxOutputTokens: 4096,
      thinkingBudget: 1024,
    });
    const evaluation = coerceEvaluation(raw);
    if (!evaluation) {
      return { evaluation: null, recChecks: [], log: ['評定のパースに失敗しました'], error: '評定を解釈できませんでした。' };
    }
    const recChecks = checkRecommendations(evaluation.recommendations, input.recCheckContext);
    const outOfBand = recChecks.filter((c) => !c.inBand).length;
    return {
      evaluation,
      recChecks,
      log: [
        `評定: ${evaluation.verdict} / 推奨 ${evaluation.recommendations.length}件${outOfBand ? `（帯外 ${outOfBand}件）` : ''}`,
      ],
    };
  } catch (e) {
    return { evaluation: null, recChecks: [], log: [], error: e instanceof Error ? e.message : String(e) };
  }
}
