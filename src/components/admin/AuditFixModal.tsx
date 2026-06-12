'use client';

/**
 * 監査修正モーダル（Agent B）。
 *
 * 指定 (scope, id) の FAIL を AI に修正させ、二層ゲート（per-content + 監査）の結果と
 * before/after diff を表示する。ユーザーが「適用」すると既存 saveEntry で永続化する。
 * エージェントは書き込まない（doc100 の役割分担）。
 */

import { useEffect, useState } from 'react';
import { applyAuditFixAction, fixAuditFindingAction, type FixAuditActionResult } from '@/app/admin/agents/actions';

type Props = {
  scope: string;
  entityId: string;
  onClose: () => void;
  onApplied: () => void;
};

export default function AuditFixModal({ scope, entityId, onClose, onApplied }: Props) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<FixAuditActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fixAuditFindingAction(scope, entityId);
      setResult(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { run(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function handleApply() {
    if (!result?.patched) return;
    setSaving(true);
    try {
      const r = await applyAuditFixAction(scope, entityId, result.patched);
      if (r.success) onApplied();
      else setError(r.error ?? '保存に失敗しました');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const diff = result?.diff ?? [];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(720px, 96vw)', maxHeight: '88vh', overflow: 'auto', background: '#111118', border: '1px solid rgba(139,0,255,0.35)', borderRadius: 12, padding: 20 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#e0d0ff', fontFamily: 'Space Grotesk, sans-serif' }}>
            ✦ AI 監査修正 — {scope} / {entityId}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9090b0', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>

        {loading && <p style={{ fontSize: 13, color: '#9090b0' }}>AI が修正案を生成中…（数秒）</p>}

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, color: '#fca5a5', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            {/* 解消対象 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#7878a8', marginBottom: 4 }}>解消対象の違反</div>
              {result.targetFindings.map((f, i) => (
                <div key={i} style={{ fontSize: 12, color: '#fca5a5' }}>• {f.message}</div>
              ))}
            </div>

            {/* 検証バッジ */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, color: result.ok ? '#86efac' : '#fca5a5', background: result.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${result.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                {result.ok ? '検証 PASS' : '検証 未解決'}
              </span>
              <span style={{ fontSize: 11, color: '#9090b0', alignSelf: 'center' }}>
                per-content {result.perContent?.ok ? 'OK' : 'NG'} / 監査{result.audit?.resolved ? ' 解消・新規なし' : ` 残${result.audit?.remainingTargetFails.length ?? 0}/新規${result.audit?.newFails.length ?? 0}`} · 試行 {result.attempts}
              </span>
            </div>

            {/* diff */}
            <div style={{ fontSize: 11, color: '#7878a8', marginBottom: 4 }}>変更点（{diff.length} フィールド）</div>
            {diff.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9090b0', marginBottom: 12 }}>変更なし</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {diff.map((d, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', background: '#0c0c12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px' }}>
                    <span style={{ color: '#d8b4fe' }}>{d.path}</span>
                    <div style={{ color: '#fca5a5' }}>- {JSON.stringify(d.before)}</div>
                    <div style={{ color: '#86efac' }}>+ {JSON.stringify(d.after)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 残存違反（あれば） */}
            {!result.ok && result.audit && (result.audit.remainingTargetFails.length > 0 || result.audit.newFails.length > 0) && (
              <div style={{ marginBottom: 12 }}>
                {result.audit.remainingTargetFails.map((f, i) => (
                  <div key={'r' + i} style={{ fontSize: 12, color: '#fca5a5' }}>未解消: {f.message}</div>
                ))}
                {result.audit.newFails.map((f, i) => (
                  <div key={'n' + i} style={{ fontSize: 12, color: '#fbbf24' }}>新規違反: [{f.scope}/{f.id}] {f.message}</div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleApply}
                disabled={!result.patched || !result.ok || saving}
                style={{ padding: '8px 18px', borderRadius: 6, background: result.ok ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${result.ok ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)'}`, color: result.ok ? '#86efac' : '#7878a8', fontSize: 13, fontWeight: 600, cursor: result.ok && !saving ? 'pointer' : 'not-allowed' }}
              >
                {saving ? '保存中…' : '適用して保存'}
              </button>
              <button onClick={run} disabled={saving} style={{ padding: '8px 18px', borderRadius: 6, background: 'rgba(139,0,255,0.15)', border: '1px solid rgba(139,0,255,0.35)', color: '#d8b4fe', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                再生成
              </button>
              <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#9090b0', fontSize: 13, cursor: 'pointer' }}>
                閉じる
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
