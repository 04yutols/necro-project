'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  applyPackageAction,
  regeneratePackageStageAction,
  reviewPackageItemAction,
  transitionPackageAction,
  undoPackageAction,
  type ReviewStudioActionResult,
} from '@/app/admin/content-packages/actions';
import type {
  ContentPackageState,
  ContentPipelineStageId,
  ContentReviewItemState,
} from '@/lib/content/contentPackage';
import type { ContentReviewSummary } from '@/lib/content/contentReviewWorkflow';

const panelStyle = { background: '#08070d', border: '1px solid rgba(139,0,255,.2)' };
const inputStyle = { background: '#050409', border: '1px solid rgba(139,0,255,.28)', color: '#e7dcf8' };

function useReviewer(): [string, (value: string) => void] {
  const [actor, setActor] = useState('yuto');
  useEffect(() => {
    const stored = window.localStorage.getItem('content-reviewer');
    if (stored) setActor(stored);
  }, []);
  const update = (value: string) => {
    setActor(value);
    window.localStorage.setItem('content-reviewer', value);
  };
  return [actor, update];
}

function ResultNotice({ result }: { result?: ReviewStudioActionResult }) {
  if (!result) return null;
  return (
    <div className="rounded-lg p-3 text-[10px] leading-5" style={{ color: result.ok ? '#8ce8bb' : '#f7a3a3', background: result.ok ? 'rgba(101,217,166,.07)' : 'rgba(248,113,113,.07)', border: `1px solid ${result.ok ? 'rgba(101,217,166,.2)' : 'rgba(248,113,113,.2)'}` }}>
      <div>{result.message}</div>
      {result.output && <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap font-mono text-[9px]" style={{ color: '#91869f' }}>{result.output}</pre>}
      {result.conflicts?.map(item => <div key={item.targetPath} className="font-mono mt-1 break-all">競合: {item.targetPath}</div>)}
    </div>
  );
}

export function ContentReviewItemControls({
  packageId,
  reviewRef,
  status,
  ready,
  reasons,
}: {
  packageId: string;
  reviewRef: string;
  status: ContentReviewItemState;
  ready: boolean;
  reasons: string[];
}) {
  const router = useRouter();
  const [actor, setActor] = useReviewer();
  const [comment, setComment] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ReviewStudioActionResult>();
  const [pending, startTransition] = useTransition();

  const decide = (decision: 'APPROVED' | 'CHANGES_REQUESTED') => startTransition(async () => {
    const response = await reviewPackageItemAction({ packageId, ref: reviewRef, status: decision, actor, comment });
    setResult(response);
    if (response.ok) {
      setComment('');
      setOpen(false);
      router.refresh();
    }
  });

  const color = status === 'APPROVED' ? '#65d9a6' : status === 'CHANGES_REQUESTED' ? '#f87171' : '#a78bfa';
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(139,0,255,.12)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[9px] font-bold tracking-wider" style={{ color }}>{status}</span>
        <button type="button" onClick={() => setOpen(value => !value)} className="rounded px-2 py-1 text-[9px]" style={{ color: '#d9c9ef', border: '1px solid rgba(139,0,255,.3)' }}>判断を記録</button>
      </div>
      {!ready && <p className="mt-2 text-[9px] leading-4" style={{ color: '#d7ae69' }}>{reasons.join(' ')}</p>}
      {open && (
        <div className="mt-3 space-y-2 rounded-lg p-3" style={panelStyle}>
          <input aria-label="レビュー担当者" value={actor} onChange={event => setActor(event.target.value)} className="w-full rounded px-3 py-2 text-[10px]" style={inputStyle} placeholder="レビュー担当者" />
          <textarea aria-label="レビューコメント" value={comment} onChange={event => setComment(event.target.value)} className="w-full rounded px-3 py-2 text-[10px] min-h-20" style={inputStyle} placeholder="判断根拠・修正指示（必須）" />
          <div className="flex gap-2">
            <button type="button" disabled={pending || !ready} onClick={() => decide('APPROVED')} className="rounded px-3 py-2 text-[9px] disabled:opacity-30" style={{ color: '#9af0c5', border: '1px solid rgba(101,217,166,.35)' }}>承認</button>
            <button type="button" disabled={pending} onClick={() => decide('CHANGES_REQUESTED')} className="rounded px-3 py-2 text-[9px] disabled:opacity-30" style={{ color: '#f7aaaa', border: '1px solid rgba(248,113,113,.35)' }}>差し戻す</button>
          </div>
          <ResultNotice result={result} />
        </div>
      )}
    </div>
  );
}

function nextTransition(status: ContentPackageState): { to: ContentPackageState; label: string } | undefined {
  if (status === 'DRAFT') return { to: 'VALIDATED', label: '自動検証を確定' };
  if (status === 'VALIDATED') return { to: 'REVIEWED', label: '人間レビューを完了' };
  if (status === 'REVIEWED') return { to: 'APPROVED', label: 'ゲーム反映を承認' };
  if (status === 'BLOCKED') return { to: 'DRAFT', label: '修正作業へ戻す' };
  return undefined;
}

export function ContentPackageWorkflowControls({
  packageId,
  status,
  summary,
  stages,
  snapshot,
  snapshotConflicts,
}: {
  packageId: string;
  status: ContentPackageState;
  summary: ContentReviewSummary;
  stages: ContentPipelineStageId[];
  snapshot?: string;
  snapshotConflicts: string[];
}) {
  const router = useRouter();
  const [actor, setActor] = useReviewer();
  const [comment, setComment] = useState('');
  const [stage, setStage] = useState<ContentPipelineStageId>(stages[0] ?? 'LORE');
  const [confirmation, setConfirmation] = useState('');
  const [forceUndo, setForceUndo] = useState(false);
  const [result, setResult] = useState<ReviewStudioActionResult>();
  const [pending, startTransition] = useTransition();
  const transition = nextTransition(status);

  const execute = (operation: () => Promise<ReviewStudioActionResult>) => startTransition(async () => {
    setResult(undefined);
    const response = await operation();
    setResult(response);
    if (response.ok) {
      setComment('');
      setConfirmation('');
      router.refresh();
    }
  });

  return (
    <section className="rounded-2xl p-4 sm:p-5 mb-7" style={{ background: 'linear-gradient(145deg, rgba(22,12,32,.98), rgba(8,7,13,.98))', border: '1px solid rgba(139,0,255,.34)' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-space tracking-[.24em] uppercase" style={{ color: '#9f63ff' }}>Human Gate</p>
          <h2 className="font-cinzel text-sm font-bold mt-1" style={{ color: '#eadfff' }}>承認・再生成・ゲーム反映</h2>
        </div>
        <div className="text-right">
          <div className="text-lg font-mono" style={{ color: summary.complete ? '#65d9a6' : '#c4b5fd' }}>{summary.approved}/{summary.total}</div>
          <div className="text-[9px]" style={{ color: '#766c84' }}>items approved</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
        <div className="rounded-xl p-3 space-y-2" style={panelStyle}>
          <div className="text-[10px] font-bold" style={{ color: '#d9ccec' }}>担当者と判断コメント</div>
          <input value={actor} onChange={event => setActor(event.target.value)} aria-label="操作担当者" className="w-full rounded px-3 py-2 text-[10px]" style={inputStyle} placeholder="担当者" />
          <textarea value={comment} onChange={event => setComment(event.target.value)} aria-label="操作コメント" className="w-full rounded px-3 py-2 text-[10px] min-h-20" style={inputStyle} placeholder="判断理由・再生成理由（必須）" />
          {transition && <button type="button" disabled={pending || (transition.to === 'REVIEWED' && !summary.complete)} onClick={() => execute(() => transitionPackageAction({ packageId, to: transition.to, actor, comment }))} className="w-full rounded px-3 py-2 text-[10px] disabled:opacity-30" style={{ color: '#e9ddf8', background: 'rgba(139,0,255,.16)', border: '1px solid rgba(139,0,255,.38)' }}>{transition.label}</button>}
          {['VALIDATED', 'REVIEWED', 'APPROVED'].includes(status) && <button type="button" disabled={pending} onClick={() => execute(() => transitionPackageAction({ packageId, to: 'DRAFT', actor, comment }))} className="w-full rounded px-3 py-2 text-[9px] disabled:opacity-30" style={{ color: '#d7ae69', border: '1px solid rgba(240,198,108,.25)' }}>DRAFTへ戻す</button>}
        </div>

        <div className="rounded-xl p-3 space-y-2" style={panelStyle}>
          <div className="text-[10px] font-bold" style={{ color: '#d9ccec' }}>工程だけ再生成</div>
          {stages.length > 0 ? (
            <>
              <select value={stage} onChange={event => setStage(event.target.value as ContentPipelineStageId)} className="w-full rounded px-3 py-2 text-[10px]" style={inputStyle} disabled={status !== 'DRAFT'}>
                {stages.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <button type="button" disabled={pending || status !== 'DRAFT'} onClick={() => execute(() => regeneratePackageStageAction({ packageId, stage, actor, reason: comment }))} className="w-full rounded px-3 py-2 text-[10px] disabled:opacity-30" style={{ color: '#c7b2e7', border: '1px solid rgba(167,139,250,.28)' }}>{stage} を再生成</button>
              <p className="text-[9px] leading-4" style={{ color: '#6f667e' }}>依存工程を無効化し、変更された承認だけをリセットします。</p>
            </>
          ) : <p className="text-[9px]" style={{ color: '#6f667e' }}>オーケストレーション情報なし</p>}
        </div>

        <div className="rounded-xl p-3 space-y-2" style={panelStyle}>
          <div className="text-[10px] font-bold" style={{ color: '#d9ccec' }}>{status === 'APPLIED' ? '復旧snapshot' : 'ゲームへ反映'}</div>
          {status === 'APPROVED' && (
            <>
              <p className="text-[9px] leading-4" style={{ color: '#8a8097' }}>確認欄: APPLY {packageId}</p>
              <input value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-label="適用確認" className="w-full rounded px-3 py-2 text-[10px] font-mono" style={inputStyle} />
              <button type="button" disabled={pending} onClick={() => execute(() => applyPackageAction({ packageId, actor, confirmation }))} className="w-full rounded px-3 py-2 text-[10px] disabled:opacity-30" style={{ color: '#9af0c5', border: '1px solid rgba(101,217,166,.35)' }}>適用 + QA</button>
            </>
          )}
          {status === 'APPLIED' && snapshot && (
            <>
              <p className="text-[9px] break-all" style={{ color: '#8a8097' }}>{snapshot}</p>
              {snapshotConflicts.length > 0 && <div className="rounded p-2 text-[9px]" style={{ color: '#f5a1a1', background: 'rgba(248,113,113,.08)' }}>{snapshotConflicts.length}件の適用後変更を検出</div>}
              <label className="flex items-center gap-2 text-[9px]" style={{ color: '#b9acc8' }}><input type="checkbox" checked={forceUndo} onChange={event => { setForceUndo(event.target.checked); setConfirmation(''); }} />競合を確認し強制復旧する</label>
              <p className="text-[9px] leading-4" style={{ color: '#8a8097' }}>確認欄: {forceUndo ? `FORCE UNDO ${packageId}` : `UNDO ${packageId}`}</p>
              <input value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-label="巻き戻し確認" className="w-full rounded px-3 py-2 text-[10px] font-mono" style={inputStyle} />
              <button type="button" disabled={pending} onClick={() => execute(() => undoPackageAction({ packageId, actor, comment, confirmation, force: forceUndo }))} className="w-full rounded px-3 py-2 text-[10px] disabled:opacity-30" style={{ color: '#f7aaaa', border: '1px solid rgba(248,113,113,.35)' }}>snapshotへ巻き戻す</button>
            </>
          )}
          {!['APPROVED', 'APPLIED'].includes(status) && <p className="text-[9px] leading-4" style={{ color: '#6f667e' }}>全項目レビュー後、REVIEWED → APPROVEDの二段階で反映可能になります。</p>}
        </div>
      </div>
      <div className="mt-3"><ResultNotice result={result} /></div>
    </section>
  );
}
