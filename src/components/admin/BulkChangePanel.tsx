'use client';

/**
 * 一括変更パネル（Agent D）。
 *
 * 設計書 105: NL→Spec(LLM翻訳) → 決定論適用 → 二層ゲート検証 → diff確認 → 承認で一括保存。
 * プレビューは非破壊。適用は applyBulkChangeAction（既存 saveEntry 経由）のみ。
 */

import { useState } from 'react';
import {
  previewBulkChangeAction,
  applyBulkChangeAction,
  type BulkPreviewResult,
} from '@/app/admin/agents/actions';

const PRESETS = [
  'MAGICAL かつ targetType が ALL_ENEMIES のスキルの power を 0.1 下げる',
  'tier が MINION の敵の stats.def を 10% 上げる',
  'rarity が R の武器の ilv を 1 にする',
];

export default function BulkChangePanel() {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ saved: number; failed: number; fail: number; warn: number } | null>(null);

  async function handlePreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setApplied(null);
    try {
      const res = await previewBulkChangeAction(instruction);
      setPreview(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!preview?.spec) return;
    setApplying(true);
    setError(null);
    try {
      const res = await applyBulkChangeAction(preview.spec);
      if (res.error) setError(res.error);
      else setApplied({ saved: res.savedIds.length, failed: res.failedIds.length, fail: res.audit.fail, warn: res.audit.warn });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  const validationById = new Map((preview?.validations ?? []).map((v) => [v.id, v]));

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>
      <h1 className="font-cinzel" style={{ fontSize: 20, fontWeight: 700, color: '#e0d0ff', marginBottom: 6, letterSpacing: 2 }}>
        BULK CHANGE — 一括変更
      </h1>
      <p style={{ fontSize: 12, color: '#7878a8', marginBottom: 16 }}>
        自然言語の指示を構造化スペックに翻訳し、対象を抽出して diff で確認。数値計算は決定論エンジンが行い、
        per-content バリデータ + 監査で検証してから一括適用します（プレビューは非破壊）。
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setInstruction(p)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#9090b0', cursor: 'pointer' }}>
            {p.length > 30 ? p.slice(0, 30) + '…' : p}
          </button>
        ))}
      </div>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder="例: MAGIC_AOE で mpCost 15 以下のスキルの power を 0.1 下げる"
        rows={3}
        style={{ width: '100%', background: '#0c0c12', border: '1px solid rgba(139,0,255,0.25)', borderRadius: 6, padding: '10px 12px', color: '#e0d0ff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
      />

      <button
        onClick={handlePreview}
        disabled={loading || instruction.trim().length < 4}
        style={{ marginTop: 10, padding: '8px 18px', borderRadius: 6, background: loading ? 'rgba(139,0,255,0.15)' : 'rgba(139,0,255,0.25)', border: '1px solid rgba(139,0,255,0.45)', color: '#e0d0ff', fontSize: 13, fontWeight: 600, cursor: loading || instruction.trim().length < 4 ? 'not-allowed' : 'pointer', opacity: instruction.trim().length < 4 ? 0.5 : 1 }}
      >
        {loading ? 'プレビュー生成中…' : 'プレビュー →'}
      </button>

      {error && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
          {error}
        </div>
      )}

      {applied && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 6, color: '#86efac', fontSize: 13 }}>
          ✓ 適用完了: {applied.saved} 件保存{applied.failed > 0 ? ` / ${applied.failed} 件失敗` : ''}。再監査: FAIL {applied.fail} / WARN {applied.warn}
        </div>
      )}

      {preview && preview.spec && (
        <div style={{ marginTop: 16 }}>
          {/* Spec */}
          <div style={{ background: '#0c0c12', border: '1px solid rgba(139,0,255,0.2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#7878a8', marginBottom: 4 }}>解釈されたスペック{preview.spec.note ? ` — ${preview.spec.note}` : ''}</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#d8b4fe' }}>
              file: {preview.spec.file} / filter: {JSON.stringify(preview.spec.filter)} / op: {JSON.stringify(preview.spec.operation)}
            </div>
          </div>

          {/* 検証サマリ */}
          <div style={{ display: 'inline-flex', gap: 12, padding: '6px 12px', borderRadius: 6, background: preview.ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${preview.ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, fontSize: 12, marginBottom: 12 }}>
            <span style={{ color: preview.ok ? '#86efac' : '#fca5a5', fontWeight: 700 }}>
              {preview.ok ? '検証 PASS' : '検証 NG'}
            </span>
            <span style={{ color: '#9090b0' }}>対象 {preview.changes.length} 件 / 新規監査FAIL {preview.newAuditFails.length}</span>
          </div>

          {preview.newAuditFails.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {preview.newAuditFails.map((f, i) => <div key={i} style={{ fontSize: 12, color: '#fca5a5' }}>新規違反: {f}</div>)}
            </div>
          )}

          {preview.missingFields.length > 0 && (
            <div style={{ marginBottom: 12, fontSize: 12, color: '#fbbf24' }}>
              ⚠ operation のフィールドが対象に存在しません（タイプミス/解釈ミスの疑い）: {preview.missingFields.join(', ')}
            </div>
          )}

          {/* diff テーブル */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, maxHeight: 360, overflow: 'auto' }}>
            {preview.changes.map((c) => {
              const v = validationById.get(c.id);
              return (
                <div key={c.id} style={{ background: '#0c0c12', border: `1px solid ${v && !v.ok ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 6, padding: '6px 10px' }}>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#9090b0' }}>{c.id}</span>
                  {c.diff.map((d, j) => (
                    <span key={j} style={{ fontSize: 12, color: '#c8c8d8', marginLeft: 8 }}>
                      <span style={{ color: '#d8b4fe' }}>{d.path}</span> {JSON.stringify(d.before)} → <b style={{ color: '#86efac' }}>{JSON.stringify(d.after)}</b>
                    </span>
                  ))}
                  {v && v.fails.length > 0 && <div style={{ fontSize: 11, color: '#fca5a5' }}>FAIL: {v.fails.join(' / ')}</div>}
                  {v && v.warns.length > 0 && <div style={{ fontSize: 11, color: '#fbbf24' }}>WARN: {v.warns.join(' / ')}</div>}
                </div>
              );
            })}
          </div>

          <button
            onClick={handleApply}
            disabled={!preview.ok || applying}
            style={{ padding: '8px 18px', borderRadius: 6, background: preview.ok ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${preview.ok ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)'}`, color: preview.ok ? '#86efac' : '#7878a8', fontSize: 13, fontWeight: 600, cursor: preview.ok && !applying ? 'pointer' : 'not-allowed' }}
          >
            {applying ? '適用中…' : `${preview.changes.length} 件を一括適用`}
          </button>
        </div>
      )}
    </div>
  );
}
