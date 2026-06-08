'use client';

/**
 * 味方魔物草案パネル。cost が戦力（stat budget）を決めるため、まず cost を選ぶ。
 * 決定論的バリデータ（cost帯 / scale）の結果を表示し、onApply で MonsterForm へ流し込む。
 */

import { useState } from 'react';
import {
  generateMonsterDraftAction,
  type GenerateMonsterActionResult,
} from '@/app/admin/agents/actions';

type Props = { onApply: (draft: Record<string, unknown>) => void };

const COSTS = [1, 2, 3] as const;
const LEVEL_COLOR: Record<string, string> = { PASS: '#4ade80', WARN: '#fbbf24', FAIL: '#f87171' };

export default function AIMonsterDraftPanel({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [cost, setCost] = useState<number>(2);
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateMonsterActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const res = await generateMonsterDraftAction(requirements, cost);
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
    <div style={{ background: 'linear-gradient(180deg, rgba(139,0,255,0.08), rgba(17,17,24,0.6))', border: '1px solid rgba(139,0,255,0.3)', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#d8b4fe', fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600 }}
      >
        <span>♟ AI 草案で味方魔物を生成（cost に合わせる）</span>
        <span style={{ color: '#7878a8' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 12, color: '#9090b0', marginBottom: 8 }}>
            味方魔物は cost（編成コスト）で戦力が決まります。cost を選ぶと、既存の cost 帯に沿った
            ステータスの魔物を生成し、コストと戦力の釣り合いを検証します。
          </p>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#9090b0', display: 'block', marginBottom: 4 }}>cost</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {COSTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCost(c)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: cost === c ? 'rgba(139,0,255,0.3)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${cost === c ? 'rgba(139,0,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: cost === c ? '#e0d0ff' : '#9090b0',
                  }}
                >
                  cost {c}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="例: 火を吐く素早いドラゴン系の魔物。氷に弱い。"
            rows={2}
            style={{ width: '100%', background: '#0c0c12', border: '1px solid rgba(139,0,255,0.25)', borderRadius: 6, padding: '10px 12px', color: '#e0d0ff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handleGenerate}
              disabled={loading || requirements.trim().length < 4}
              style={{ padding: '8px 18px', borderRadius: 6, background: loading ? 'rgba(139,0,255,0.15)' : 'rgba(139,0,255,0.25)', border: '1px solid rgba(139,0,255,0.45)', color: '#e0d0ff', fontSize: 13, fontWeight: 600, cursor: loading || requirements.trim().length < 4 ? 'not-allowed' : 'pointer', opacity: requirements.trim().length < 4 ? 0.5 : 1 }}
            >
              {loading ? '生成中…' : '草案を生成 →'}
            </button>
            {result?.draft && (
              <button
                onClick={handleApply}
                style={{ padding: '8px 18px', borderRadius: 6, background: applied ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.45)', color: '#86efac', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {applied ? '✓ 反映済み（保存ボタンで確定）' : 'フォームに反映 ↓'}
              </button>
            )}
          </div>

          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 12 }}>
              {result.log.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  {result.log.map((l, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#7878a8', fontFamily: 'monospace' }}>• {l}</div>
                  ))}
                </div>
              )}

              {result.validation && (
                <div style={{ display: 'inline-flex', gap: 12, padding: '6px 12px', borderRadius: 6, background: result.validation.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${result.validation.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: result.validation.ok ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
                    決定論的検証: {result.validation.ok ? 'PASS' : 'FAIL'}
                  </span>
                  <span style={{ color: '#9090b0' }}>FAIL {failCount} / WARN {warnCount} · 試行 {result.attempts} 回</span>
                </div>
              )}

              {result.idCollision && (
                <div style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8 }}>
                  ⚠ id「{String(result.draft?.id)}」は既存と重複します。保存前に変更してください。
                </div>
              )}

              {problems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {problems.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: LEVEL_COLOR[f.level] ?? '#fff' }}>
                      [{f.level}] {f.field}: {f.message}
                    </div>
                  ))}
                </div>
              )}

              {result.draft && (
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: '#9090b0' }}>生成された草稿 JSON を表示</summary>
                  <pre style={{ marginTop: 8, padding: 12, background: '#0c0c12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 11, color: '#c8b4f8', overflow: 'auto', maxHeight: 320 }}>
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
