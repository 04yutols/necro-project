'use client';

/**
 * スキル草案パネル。
 *
 * スキルは職業（または魔物）に紐づくため、まず紐付き先を選んでから生成する。
 * 決定論的バリデータ（設計書19 power 表 + owner-fit）の結果を表示し、
 * onApply で SkillForm に流し込む。保存は既存 saveEntry が担う。
 */

import { useEffect, useState } from 'react';
import {
  generateSkillDraftAction,
  getSkillOwnerOptions,
  evaluateSkillDraftAction,
  type GenerateSkillActionResult,
  type SkillOwnerSelector,
  type EvaluateBalanceActionResult,
} from '@/app/admin/agents/actions';

const VERDICT_LABEL: Record<string, { label: string; color: string }> = {
  BALANCED: { label: '適正', color: '#86efac' },
  TOO_STRONG: { label: '強すぎ', color: '#fca5a5' },
  TOO_WEAK: { label: '弱すぎ', color: '#fbbf24' },
};

type Props = {
  onApply: (draft: Record<string, unknown>) => void;
};

const LEVEL_COLOR: Record<string, string> = { PASS: '#4ade80', WARN: '#fbbf24', FAIL: '#f87171' };

export default function AISkillDraftPanel({ onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<{ id: string; label: string }[]>([]);
  const [monsters, setMonsters] = useState<{ id: string; label: string }[]>([]);
  const [ownerKey, setOwnerKey] = useState<string>(''); // "job:warrior" / "monster:imp"
  const [requirements, setRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateSkillActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluateBalanceActionResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);

  async function handleEvaluate() {
    if (!result?.draft) return;
    const [kind, id] = ownerKey.split(':');
    if (kind !== 'job') { setError('バランス評価は職業スキルのみ対応です。'); return; }
    setEvalLoading(true);
    setEvalResult(null);
    try {
      const res = await evaluateSkillDraftAction(result.draft, id);
      setEvalResult(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEvalLoading(false);
    }
  }

  useEffect(() => {
    if (!open || jobs.length > 0) return;
    getSkillOwnerOptions()
      .then((opts) => {
        setJobs(opts.jobs);
        setMonsters(opts.monsters);
        if (opts.jobs[0]) setOwnerKey(`job:${opts.jobs[0].id}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [open, jobs.length]);

  function parseOwner(): SkillOwnerSelector | null {
    const [kind, id] = ownerKey.split(':');
    if ((kind === 'job' || kind === 'monster') && id) return { kind, id };
    return null;
  }

  async function handleGenerate() {
    const owner = parseOwner();
    if (!owner) {
      setError('紐付き先（職業または魔物）を選択してください。');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    setEvalResult(null);
    try {
      const res = await generateSkillDraftAction(requirements, owner);
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
        <span>✦ AI 草案でスキルを生成（紐付き先に合わせる）</span>
        <span style={{ color: '#7878a8' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 12, color: '#9090b0', marginBottom: 8 }}>
            スキルは職業・魔物に紐づきます。紐付き先を選ぶと、その系統(物理/魔法)・基礎攻撃・Tier に合うスキルを
            設計書19の power 表に沿って生成し、整合を検証します。
          </p>

          {/* 紐付き先セレクタ */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#9090b0', display: 'block', marginBottom: 4 }}>紐付き先</label>
            <select
              value={ownerKey}
              onChange={(e) => setOwnerKey(e.target.value)}
              style={{ width: '100%', background: '#0c0c12', border: '1px solid rgba(139,0,255,0.25)', borderRadius: 6, padding: '8px 10px', color: '#e0d0ff', fontSize: 13 }}
            >
              <optgroup label="職業">
                {jobs.map((j) => <option key={j.id} value={`job:${j.id}`}>{j.label}</option>)}
              </optgroup>
              <optgroup label="魔物">
                {monsters.map((m) => <option key={m.id} value={`monster:${m.id}`}>{m.label}</option>)}
              </optgroup>
            </select>
          </div>

          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="例: 中コストの単体大ダメージ。炎を纏った一撃で前衛を焼く。"
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
            {result?.draft && ownerKey.startsWith('job:') && (
              <button
                onClick={handleEvaluate}
                disabled={evalLoading}
                style={{ padding: '8px 18px', borderRadius: 6, background: 'rgba(139,0,255,0.15)', border: '1px solid rgba(139,0,255,0.35)', color: '#d8b4fe', fontSize: 13, fontWeight: 600, cursor: evalLoading ? 'wait' : 'pointer' }}
              >
                {evalLoading ? '評価中…' : '⚖ バランス評価'}
              </button>
            )}
          </div>

          {evalResult?.evaluation && evalResult.report && (
            <div style={{ marginTop: 10, padding: '10px 12px', background: '#0c0c12', border: '1px solid rgba(139,0,255,0.25)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: '#7878a8', marginBottom: 6 }}>
                全敵シミュレート: 1確率 {Math.round(evalResult.report.summary.oneShotRate * 100)}% / 効率 {evalResult.report.summary.energyEfficiency ?? 'N/A'} / 平均期待 {evalResult.report.summary.avgExpected}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: VERDICT_LABEL[evalResult.evaluation.verdict]?.color }}>
                {VERDICT_LABEL[evalResult.evaluation.verdict]?.label}（{evalResult.evaluation.verdict}）
              </span>
              <p style={{ fontSize: 12, color: '#c8c8d8', marginTop: 6, lineHeight: 1.5 }}>{evalResult.evaluation.rationale}</p>
              {evalResult.evaluation.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: 12, color: '#c8c8d8', marginTop: 4 }}>
                  <span style={{ fontFamily: 'monospace', color: '#d8b4fe' }}>{r.target}</span> {r.current} → <b style={{ color: '#86efac' }}>{r.suggested}</b>
                  <span style={{ color: '#7878a8' }}> — {r.reason}</span>
                  {evalResult.recChecks[i] && !evalResult.recChecks[i].inBand && <span style={{ color: '#fbbf24', fontSize: 11 }}> {evalResult.recChecks[i].note}</span>}
                </div>
              ))}
            </div>
          )}

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
