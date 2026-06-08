'use client';

/**
 * ステージ草案パネル。
 *
 * ステージはエリアに紐づき、waves に敵を配置する複合データ。エリアを選んで生成すると、
 * そのエリアの chapter/area に整合し、実在する敵/解放条件/ドロップで構成されたステージを
 * 生成する。決定論的バリデータ（参照整合）の結果を表示し、onApply で StageForm へ流し込む。
 */

import { useEffect, useState } from 'react';
import {
  generateStageDraftAction,
  getStageAreaOptions,
  type GenerateStageActionResult,
} from '@/app/admin/agents/actions';

type Props = { onApply: (draft: Record<string, unknown>) => void };

const LEVEL_COLOR: Record<string, string> = { PASS: '#4ade80', WARN: '#fbbf24', FAIL: '#f87171' };

export default function AIStageDraftPanel({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [areas, setAreas] = useState<{ id: string; label: string }[]>([]);
  const [areaId, setAreaId] = useState('');
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateStageActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!open || areas.length > 0) return;
    getStageAreaOptions()
      .then((opts) => {
        setAreas(opts);
        if (opts[0]) setAreaId(opts[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [open, areas.length]);

  async function handleGenerate() {
    if (!areaId) {
      setError('紐付き先のエリアを選択してください。');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const res = await generateStageDraftAction(requirements, areaId);
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
        <span>⚑ AI 草案でステージを生成（エリアに合わせる）</span>
        <span style={{ color: '#7878a8' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 12, color: '#9090b0', marginBottom: 8 }}>
            ステージはエリアに紐づきます。エリアを選ぶと、その chapter/area に整合し、実在する敵を waves に
            配置した進行（解放条件・難易度・報酬）を生成し、参照整合を検証します。
          </p>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#9090b0', display: 'block', marginBottom: 4 }}>紐付き先のエリア</label>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              style={{ width: '100%', background: '#0c0c12', border: '1px solid rgba(139,0,255,0.25)', borderRadius: 6, padding: '8px 10px', color: '#e0d0ff', fontSize: 13 }}
            >
              {areas.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>

          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="例: エリアの中盤ダンジョン。3WAVE構成で、シールド持ちと精鋭が出る。氷弱点の敵を活かす。"
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
                  <pre style={{ marginTop: 8, padding: 12, background: '#0c0c12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, fontSize: 11, color: '#c8b4f8', overflow: 'auto', maxHeight: 360 }}>
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
