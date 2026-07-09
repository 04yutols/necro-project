'use client';

/**
 * ストーリーシーン候補パネル（Agent C）。
 *
 * 設計書 104: 構造は決定論ゲートで担保され、物語の質は「多案 → 人間選択」。
 * 3 案を並べて表示し、ユーザーが選んだ案の lines をフォームに反映する（保存は既存 saveStoryScene）。
 * new モード（AI初稿）と complete モード（既存 lines の補完）を isNew で切替。
 */

import { useState } from 'react';
import {
  generateStorySceneAction,
  completeSceneLinesAction,
  type StorySceneActionResult,
} from '@/app/admin/agents/actions';
import type { StoryScene, DialogueLine } from '@/types/story';

type Props = {
  currentScene: StoryScene;
  isNew: boolean;
  packId?: string;
  onApply: (lines: DialogueLine[]) => void;
};

export default function AIStorySceneCandidates({ currentScene, isNew, packId, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StorySceneActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setAppliedIdx(null);
    try {
      let res: StorySceneActionResult;
      if (isNew) {
        // 骨子 = 現在のフォーム（lines を除く）
        const { lines: _lines, ...skeleton } = currentScene as unknown as Record<string, unknown>;
        void _lines;
        res = await generateStorySceneAction(brief, skeleton, { packId, insertAfterId: null });
      } else {
        res = await completeSceneLinesAction(currentScene.id, brief, { packId });
      }
      setResult(res);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const candidates = result?.candidates ?? [];

  return (
    <div style={{ background: 'linear-gradient(180deg, rgba(139,0,255,0.08), rgba(17,17,24,0.6))', border: '1px solid rgba(139,0,255,0.3)', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#d8b4fe', fontFamily: 'Space Grotesk, sans-serif', fontSize: 14, fontWeight: 600 }}
      >
        <span>✦ {isNew ? 'AI初稿（台詞を3案生成）' : 'AI補完（lines を3案で埋める）'}</span>
        <span style={{ color: '#7878a8' }}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <p style={{ fontSize: 12, color: '#9090b0', marginBottom: 8 }}>
            キャラの口調・前後の流れ・固有名詞を踏まえて台詞を3案生成します。構造（speaker/表情/参照）は
            決定論的に検証済みの案のみ表示。良い案を選んでフォームに反映してください。
          </p>

          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={isNew ? '例: アルドが廃城前で亡き友ラインを思い出すモノローグ。喪失と前進。' : '例: もっと抑制的で皮肉混じりのトーンに。'}
            rows={2}
            style={{ width: '100%', background: '#0c0c12', border: '1px solid rgba(139,0,255,0.25)', borderRadius: 6, padding: '10px 12px', color: '#e0d0ff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
          />

          <button
            onClick={handleGenerate}
            disabled={loading || brief.trim().length < 4}
            style={{ marginTop: 10, padding: '8px 18px', borderRadius: 6, background: loading ? 'rgba(139,0,255,0.15)' : 'rgba(139,0,255,0.25)', border: '1px solid rgba(139,0,255,0.45)', color: '#e0d0ff', fontSize: 13, fontWeight: 600, cursor: loading || brief.trim().length < 4 ? 'not-allowed' : 'pointer', opacity: brief.trim().length < 4 ? 0.5 : 1 }}
          >
            {loading ? '生成中…（数秒〜十数秒）' : '3案を生成 →'}
          </button>

          {error && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, color: '#fca5a5', fontSize: 12 }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#7878a8', marginBottom: 8 }}>
                構造妥当な候補: {candidates.length}案{result.rejected > 0 ? `（構造不備で ${result.rejected} 案除外）` : ''} · 試行 {result.attempts}
                {result.log.map((l, i) => <span key={i} style={{ display: 'block', fontFamily: 'monospace' }}>• {l}</span>)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {candidates.map((c, i) => {
                  const lines = (c.scene.lines as DialogueLine[]) ?? [];
                  const hasWarn = c.validation.findings.some((f) => f.level === 'WARN');
                  return (
                    <div key={i} style={{ background: '#0c0c12', border: '1px solid rgba(139,0,255,0.2)', borderRadius: 8, padding: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#d8b4fe' }}>
                          案 {i + 1} <span style={{ color: '#86efac', fontWeight: 400 }}>構造 PASS</span>{hasWarn && <span style={{ color: '#fbbf24', fontWeight: 400 }}> ・WARN</span>}
                        </span>
                        <button
                          onClick={() => { onApply(lines); setAppliedIdx(i); }}
                          style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, background: appliedIdx === i ? 'rgba(74,222,128,0.15)' : 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.45)', color: '#86efac', cursor: 'pointer' }}
                        >
                          {appliedIdx === i ? '✓ 反映済み（保存で確定）' : 'この案を反映 ↓'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {lines.map((ln, j) => (
                          <div key={j} style={{ fontSize: 12, color: '#c8c8d8', lineHeight: 1.5 }}>
                            <span style={{ color: '#9090b0', fontFamily: 'monospace', fontSize: 11 }}>
                              {ln.speaker ?? 'ナレ'}{ln.expression ? `(${ln.expression})` : ''}:
                            </span>{' '}
                            {ln.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {candidates.length === 0 && !error && (
                  <div style={{ fontSize: 12, color: '#fbbf24' }}>
                    構造妥当な候補が得られませんでした。
                    {result.rejectionReasons.length > 0 && (
                      <div style={{ marginTop: 4, color: '#fca5a5' }}>
                        除外理由: {result.rejectionReasons.join(' / ')}
                        <div style={{ color: '#7878a8', marginTop: 2 }}>（シーンの基本情報 archiveTitle / trigger / id 等を先に埋めてから再生成してください）</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
