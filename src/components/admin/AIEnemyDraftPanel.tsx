'use client';

/**
 * Agent A: エネミー草案パネル。
 *
 * 設計書 100 の役割分担に従い、このパネルは「草稿生成」までを担う。
 * 生成された草稿は onApply で既存フォームに流し込まれ、保存は既存の
 * saveEntry（FormSaveBar の保存ボタン）が担う。検証結果は決定論的
 * バリデータ（enemyBalance.ts）の出力をそのまま表示する。
 */

import { useState } from 'react';
import {
  generateEnemyDraftAction,
  evaluateEnemyDraftAction,
  type GenerateEnemyActionResult,
  type EvaluateEnemyDraftResult,
} from '@/app/admin/agents/actions';

type Props = {
  onApply: (draft: Record<string, unknown>) => void;
};

const VERDICT_LABEL: Record<string, { label: string; color: string }> = {
  BALANCED: { label: '適正', color: '#86efac' },
  TOO_STRONG: { label: '硬すぎ', color: '#fca5a5' },
  TOO_WEAK: { label: '脆すぎ', color: '#fbbf24' },
};

const PRESETS = [
  'area1 序盤の弱い MINION。BEAST 系で素早く、火に弱い。',
  'area1_boss の前座になる ICE 弱点の高DEF ELITE アンデッド。',
  '王都を彷徨う HUMANOID の MINION。状態異常付与が脅威で雷に弱い。',
];

const LEVEL_COLOR: Record<string, string> = {
  PASS: '#4ade80',
  WARN: '#fbbf24',
  FAIL: '#f87171',
};

export default function AIEnemyDraftPanel({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateEnemyActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateEnemyDraftResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  async function handleEvaluate() {
    if (!result?.draft) return;
    setEvalLoading(true);
    setEvalResult(null);
    try {
      const res = await evaluateEnemyDraftAction(result.draft);
      setEvalResult(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEvalLoading(false);
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    setEvalResult(null);
    try {
      const res = await generateEnemyDraftAction(requirements);
      setResult(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (result?.draft) {
      onApply(result.draft);
      setApplied(true);
    }
  }

  const findings = result?.validation?.findings ?? [];
  const failCount = findings.filter((f) => f.level === 'FAIL').length;
  const warnCount = findings.filter((f) => f.level === 'WARN').length;
  const problems = findings.filter((f) => f.level !== 'PASS');

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, rgba(139,0,255,0.08), rgba(17,17,24,0.6))',
        border: '1px solid rgba(139,0,255,0.3)',
        borderRadius: 10,
        marginBottom: 16,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#d8b4fe',
          fontFamily: 'Space Grotesk, sans-serif',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span>✦ AI 草案で下書きを生成（Gemini）</span>
        <span style={{ color: '#7878a8' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 12, color: '#9090b0', marginBottom: 8 }}>
            自然言語で要件を入力すると、既存データと整合する草稿を生成します。生成後は
            決定論的バリデータの検証結果を確認し、「フォームに反映」してから保存してください。
          </p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setRequirements(p)}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#9090b0',
                  cursor: 'pointer',
                }}
              >
                {p.length > 24 ? p.slice(0, 24) + '…' : p}
              </button>
            ))}
          </div>

          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="例: area1_boss の前座になる ICE 弱点の高DEF ELITE アンデッド。氷スキルの価値を示す重い壁。"
            rows={3}
            style={{
              width: '100%',
              background: '#0c0c12',
              border: '1px solid rgba(139,0,255,0.25)',
              borderRadius: 6,
              padding: '10px 12px',
              color: '#e0d0ff',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handleGenerate}
              disabled={loading || requirements.trim().length < 4}
              style={{
                padding: '8px 18px',
                borderRadius: 6,
                background: loading ? 'rgba(139,0,255,0.15)' : 'rgba(139,0,255,0.25)',
                border: '1px solid rgba(139,0,255,0.45)',
                color: '#e0d0ff',
                fontSize: 13,
                fontWeight: 600,
                cursor: loading || requirements.trim().length < 4 ? 'not-allowed' : 'pointer',
                opacity: requirements.trim().length < 4 ? 0.5 : 1,
              }}
            >
              {loading ? '生成中…（数秒〜十数秒）' : '草案を生成 →'}
            </button>
            {result?.draft && (
              <button
                onClick={handleApply}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: applied ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.2)',
                  border: '1px solid rgba(74,222,128,0.45)',
                  color: '#86efac',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {applied ? '✓ 反映済み（保存ボタンで確定）' : 'フォームに反映 ↓'}
              </button>
            )}
            {result?.draft && (
              <button
                onClick={handleEvaluate}
                disabled={evalLoading}
                style={{
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: 'rgba(139,0,255,0.15)',
                  border: '1px solid rgba(139,0,255,0.35)',
                  color: '#d8b4fe',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: evalLoading ? 'wait' : 'pointer',
                }}
              >
                {evalLoading ? '評価中…' : '⚖ バランス評価'}
              </button>
            )}
          </div>

          {evalResult?.evaluation && evalResult.report && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#0c0c12', border: '1px solid rgba(139,0,255,0.25)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#7878a8', marginBottom: 6 }}>
                代表アタッカー（全職業中央値 atk {evalResult.report.attacker.atk}）× 代表スキル {evalResult.report.rows.length} 種:
                平均撃破 {evalResult.report.summary.avgHitsToKill} 発 / 1確 {evalResult.report.summary.oneShotCount} 種 / 弱点ヒット {evalResult.report.summary.weaknessHitCount} 種
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
                {evalResult.report.rows.map((r, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#9090b0', fontFamily: 'monospace' }}>
                    {r.skill.id}（{r.skill.classification}）→ 期待 {r.result.expected} / {r.result.oneShot ? '1確' : `${r.result.hitsToKill}発`}
                    {r.result.isWeakness ? ' / 弱点' : r.result.isResisted ? ' / 耐性' : ''}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: VERDICT_LABEL[evalResult.evaluation.verdict]?.color }}>
                {VERDICT_LABEL[evalResult.evaluation.verdict]?.label}（{evalResult.evaluation.verdict}）
              </span>
              <p style={{ fontSize: 12, color: '#c8c8d8', marginTop: 6, lineHeight: 1.5 }}>{evalResult.evaluation.rationale}</p>
              {evalResult.evaluation.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#c8c8d8', marginTop: 4 }}>
                  <span style={{ fontFamily: 'monospace', color: '#d8b4fe' }}>{r.target}</span> {r.current} → <b style={{ color: '#86efac' }}>{r.suggested}</b>
                  <span style={{ color: '#7878a8' }}> — {r.reason}</span>
                  {evalResult.recChecks[i] && !evalResult.recChecks[i].inBand && (
                    <span style={{ color: '#fbbf24', fontSize: 11 }}> {evalResult.recChecks[i].note}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                background: 'rgba(127,29,29,0.3)',
                border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 6,
                color: '#fca5a5',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 12 }}>
              {/* ログ */}
              {result.log.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {result.log.map((l, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#7878a8', fontFamily: 'monospace' }}>
                      • {l}
                    </div>
                  ))}
                </div>
              )}

              {/* 検証サマリ */}
              {result.validation && (
                <div
                  style={{
                    display: 'inline-flex',
                    gap: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: result.validation.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${result.validation.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    fontSize: 12,
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: result.validation.ok ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                    決定論的検証: {result.validation.ok ? 'PASS' : 'FAIL'}
                  </span>
                  <span style={{ color: '#9090b0' }}>
                    FAIL {failCount} / WARN {warnCount} · 試行 {result.attempts} 回
                  </span>
                </div>
              )}

              {result.idCollision && (
                <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>
                  ⚠ id「{String(result.draft?.id)}」は既存と重複します。保存前に ID を変更してください。
                </div>
              )}

              {/* 検証詳細 */}
              {problems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {problems.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: LEVEL_COLOR[f.level] ?? '#fff' }}>
                      [{f.level}] {f.field}: {f.message}
                    </div>
                  ))}
                </div>
              )}

              {/* 草稿 JSON プレビュー */}
              {result.draft && (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: '#9090b0' }}>
                    生成された草稿 JSON を表示
                  </summary>
                  <pre
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#0c0c12',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      fontSize: 11,
                      color: '#c8b4f8',
                      overflow: 'auto',
                      maxHeight: 320,
                    }}
                  >
                    {JSON.stringify(result.draft, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
