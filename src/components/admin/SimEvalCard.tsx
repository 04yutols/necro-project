'use client';

/**
 * シミュレータ AI 評価カード（Agent E）。
 *
 * 決定論レポート要約 + LLM 評定 + 調整推奨を表示する。
 * 数値は calculateBattleDamage 由来（LLM は解釈のみ）。推奨は「この値で再シミュレート」できる。
 */

import { useState } from 'react';
import { evaluateBalanceAction, type EvaluateBalanceActionResult } from '@/app/admin/agents/actions';

type Props = {
  jobId: string;
  skillId: string;
  level: number;
  /** 単一敵に絞る場合の id（未指定 or 全敵展開時は undefined）。 */
  enemyId?: string;
  /** 推奨 power を simulator に流し込む（skill.power のみ対応）。 */
  onApplyPower?: (value: number) => void;
};

const VERDICT_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  BALANCED: { color: '#86efac', bg: 'rgba(74,222,128,0.12)', label: '適正' },
  TOO_STRONG: { color: '#fca5a5', bg: 'rgba(248,113,113,0.12)', label: '強すぎ' },
  TOO_WEAK: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', label: '弱すぎ' },
};

export default function SimEvalCard({ jobId, skillId, level, enemyId, onApplyPower }: Props) {
  const [allEnemies, setAllEnemies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluateBalanceActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEvaluate() {
    if (!skillId) { setError('スキルを選択してください。'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const enemyIds = allEnemies ? undefined : enemyId ? [enemyId] : undefined;
      const res = await evaluateBalanceAction(jobId, skillId, level, enemyIds);
      setResult(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const report = result?.report;
  const ev = result?.evaluation;
  const vs = ev ? VERDICT_STYLE[ev.verdict] : null;

  return (
    <div style={{ background: 'linear-gradient(180deg, rgba(139,0,255,0.08), rgba(17,17,24,0.6))', border: '1px solid rgba(139,0,255,0.3)', borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#d8b4fe', fontFamily: 'Space Grotesk, sans-serif' }}>
          ✦ AI バランス評価
        </span>
        <label style={{ fontSize: 11, color: '#9090b0', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={allEnemies} onChange={(e) => setAllEnemies(e.target.checked)} />
          章の全敵に展開
        </label>
        <button
          onClick={handleEvaluate}
          disabled={loading || !skillId}
          style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: 6, background: loading ? 'rgba(139,0,255,0.15)' : 'rgba(139,0,255,0.25)', border: '1px solid rgba(139,0,255,0.45)', color: '#e0d0ff', fontSize: 12, fontWeight: 600, cursor: loading || !skillId ? 'not-allowed' : 'pointer' }}
        >
          {loading ? '評価中…' : 'AI評価を実行'}
        </button>
      </div>
      <p style={{ fontSize: 11, color: '#7878a8', marginTop: 6 }}>
        ダメージは実バトルと同一の計算式で算出した確定値です。AI はその数値を解釈して評定します。
      </p>

      {error && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
          {error}
        </div>
      )}

      {report && (
        <div style={{ marginTop: 12 }}>
          {/* 決定論レポート要約 */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: '#c8c8d8', marginBottom: 10 }}>
            <span>1確率 <b style={{ color: '#e0d0ff' }}>{Math.round(report.summary.oneShotRate * 100)}%</b></span>
            <span>平均期待 <b style={{ color: '#e0d0ff' }}>{report.summary.avgExpected}</b></span>
            <span>効率 <b style={{ color: '#e0d0ff' }}>{report.summary.energyEfficiency ?? 'N/A'}</b></span>
            <span>弱点カバー <b style={{ color: '#e0d0ff' }}>{Math.round(report.summary.weaknessCoverage * 100)}%</b></span>
          </div>

          {/* per-target テーブル */}
          <details style={{ marginBottom: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 11, color: '#9090b0' }}>対象別ダメージ（{report.perTarget.length}体）</summary>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {report.perTarget.map((p) => (
                <div key={p.id} style={{ fontSize: 11, fontFamily: 'monospace', color: '#9090b0' }}>
                  {p.id}{p.tier ? ` [${p.tier}]` : ''} HP{p.hp} → 期待{p.expected} / {p.oneShot ? '1確' : `${p.hitsToKill}発`} {p.isWeakness ? '弱点' : p.isResisted ? '耐性' : ''}
                </div>
              ))}
            </div>
          </details>

          {/* LLM 評定 */}
          {ev && vs && (
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, color: vs.color, background: vs.bg, border: `1px solid ${vs.color}55` }}>
                {vs.label}（{ev.verdict}）
              </span>
              <p style={{ fontSize: 12, color: '#c8c8d8', marginTop: 8, lineHeight: 1.6 }}>{ev.rationale}</p>

              {ev.recommendations.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: '#7878a8' }}>調整推奨</div>
                  {ev.recommendations.map((r, i) => {
                    const check = result?.recChecks[i];
                    return (
                      <div key={i} style={{ fontSize: 12, color: '#c8c8d8', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', color: '#d8b4fe' }}>{r.target}</span>
                        <span>{r.current} → <b style={{ color: '#86efac' }}>{r.suggested}</b></span>
                        <span style={{ color: '#7878a8' }}>{r.reason}</span>
                        {check && !check.inBand && <span style={{ color: '#fbbf24', fontSize: 11 }}>{check.note}</span>}
                        {r.target === 'skill.power' && onApplyPower && (
                          <button
                            onClick={() => onApplyPower(r.suggested)}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.4)', color: '#86efac', cursor: 'pointer' }}
                          >
                            この値で再シミュレート
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
