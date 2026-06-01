'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { StoryScene, SceneTrigger } from '@/types/story';

const TYPE_COLORS: Record<string, string> = {
  DIALOGUE:      '#a78bfa',
  MONOLOGUE:     '#67e8f9',
  ENVIRONMENT:   '#4ade80',
  CHAPTER_TITLE: '#fbbf24',
  CHOICE:        '#f87171',
};

const TRIGGER_LABELS: Record<string, string> = {
  GAME_START:    'ゲーム開始',
  FLAG_SET:      'フラグ',
  STAGE_CLEAR:   'ステージクリア',
  STAGE_ENTER:   'ステージ入場',
  AREA_UNLOCK:   'エリア解放',
  BOSS_CLEAR:    'ボス討伐',
  DEMONIZE_FIRST:'初魔神化',
  MANUAL:        '手動',
};

function triggerLabel(trigger: SceneTrigger): string {
  const base = TRIGGER_LABELS[trigger.type] ?? trigger.type;
  if ('stageId' in trigger) return `${base}: ${trigger.stageId}`;
  if ('flagKey' in trigger) return `${base}: ${trigger.flagKey}`;
  if ('bossStageId' in trigger) return `${base}: ${trigger.bossStageId}`;
  if ('areaId' in trigger) return `${base}: ${trigger.areaId}`;
  if ('sceneId' in trigger) return `${base}: ${trigger.sceneId}`;
  return base;
}

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? '#7878a8';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: 6, fontSize: 11,
      fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      background: `${color}20`, border: `1px solid ${color}50`,
      color, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

const SCENE_TYPES = ['DIALOGUE', 'MONOLOGUE', 'ENVIRONMENT', 'CHAPTER_TITLE'];
const TRIGGER_TYPES = Object.keys(TRIGGER_LABELS);

export default function StoryScenesList({ scenes }: { scenes: StoryScene[] }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('');

  const filtered = useMemo(() => {
    let list = scenes;
    const q = search.toLowerCase();
    if (q) list = list.filter((s) =>
      s.id.toLowerCase().includes(q) ||
      s.archiveTitle.toLowerCase().includes(q) ||
      s.lines.some((l) => l.text.toLowerCase().includes(q))
    );
    if (typeFilter) list = list.filter((s) => s.type === typeFilter);
    if (triggerFilter) list = list.filter((s) => s.trigger.type === triggerFilter);
    return list;
  }, [scenes, search, typeFilter, triggerFilter]);

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        background: '#111118', border: '1px solid rgba(139,0,255,0.15)',
        borderRadius: 10, padding: '14px 16px', marginBottom: 20,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#7878a8', pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="検索（ID・タイトル・台詞本文）"
              style={{
                height: 42, background: '#0d0d14',
                border: '1px solid rgba(139,0,255,0.22)', borderRadius: 8,
                padding: '0 14px 0 38px', color: '#e0d0ff', fontSize: 14,
                width: '100%', outline: 'none',
                fontFamily: 'Space Grotesk, sans-serif', boxSizing: 'border-box',
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: filtered.length < scenes.length ? '#c084fc' : '#7878a8', fontFamily: 'Space Mono, monospace', whiteSpace: 'nowrap', fontWeight: filtered.length < scenes.length ? 600 : 400 }}>
            {filtered.length === scenes.length ? `${scenes.length} 件` : `${filtered.length} / ${scenes.length}`}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {/* Type filter */}
          {['', ...SCENE_TYPES].map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} style={{
              height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12,
              fontFamily: 'Space Grotesk, sans-serif', cursor: 'pointer',
              background: typeFilter === t ? (t ? `${TYPE_COLORS[t]}20` : 'rgba(139,0,255,0.18)') : 'rgba(255,255,255,0.04)',
              border: `1px solid ${typeFilter === t ? (t ? `${TYPE_COLORS[t]}50` : 'rgba(139,0,255,0.5)') : 'rgba(255,255,255,0.1)'}`,
              color: typeFilter === t ? (t ? TYPE_COLORS[t] : '#d8b4fe') : '#8080a0',
              fontWeight: typeFilter === t ? 600 : 400,
            }}>
              {t || 'ALL TYPE'}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '7px 4px', flexShrink: 0 }} />
          {['', ...TRIGGER_TYPES].map((t) => (
            <button key={t} onClick={() => setTriggerFilter(t)} style={{
              height: 34, padding: '0 14px', borderRadius: 8, fontSize: 12,
              fontFamily: 'Space Grotesk, sans-serif', cursor: 'pointer',
              background: triggerFilter === t ? 'rgba(139,0,255,0.18)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${triggerFilter === t ? 'rgba(139,0,255,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: triggerFilter === t ? '#d8b4fe' : '#8080a0',
              fontWeight: triggerFilter === t ? 600 : 400,
            }}>
              {t ? (TRIGGER_LABELS[t] ?? t) : 'ALL TRIGGER'}
            </button>
          ))}
        </div>
      </div>

      {/* Scene list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((scene) => (
          <div key={scene.id} style={{
            background: '#111118',
            border: '1px solid rgba(139,0,255,0.15)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 16px', minHeight: 58,
            }}>
              {/* Sequence number */}
              <span style={{
                flexShrink: 0, width: 32, textAlign: 'center',
                fontSize: 12, fontFamily: 'Space Mono, monospace', color: '#555570',
              }}>
                {scene.sequence ?? '—'}
              </span>

              {/* Type badge */}
              <TypeBadge type={scene.type} />

              {/* ID */}
              <span style={{
                flexShrink: 0, fontSize: 12,
                fontFamily: 'Space Mono, monospace', color: '#8B00FF',
                minWidth: 140, maxWidth: 200,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {scene.id}
              </span>

              {/* Archive title */}
              <span style={{
                fontSize: 14, fontFamily: 'Space Grotesk, sans-serif',
                fontWeight: 500, color: '#d0c0f0', flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {scene.archiveTitle || (scene.title ?? '—')}
              </span>

              {/* Trigger */}
              <span style={{
                flexShrink: 0, fontSize: 11,
                fontFamily: 'Space Mono, monospace', color: '#7878a8',
                padding: '3px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                whiteSpace: 'nowrap', maxWidth: 200,
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {triggerLabel(scene.trigger)}
              </span>

              {/* Line count */}
              <span style={{
                flexShrink: 0, fontSize: 12,
                fontFamily: 'Space Mono, monospace', color: '#555570',
                minWidth: 44, textAlign: 'right',
              }}>
                {scene.lines.length > 0 ? `${scene.lines.length}行` : 'NO LINE'}
              </span>

              {/* Edit button */}
              <Link
                href={`/admin/story/${scene.id}`}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 38, padding: '0 20px', borderRadius: 8,
                  background: 'rgba(139,0,255,0.15)',
                  border: '1px solid rgba(139,0,255,0.4)',
                  color: '#d8b4fe', textDecoration: 'none',
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                編集 →
              </Link>
            </div>

            {/* First line preview */}
            {scene.lines.length > 0 && (
              <div style={{
                borderTop: '1px solid rgba(139,0,255,0.08)',
                padding: '8px 16px 10px 60px',
              }}>
                <span style={{ fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', color: '#555570' }}>
                  {scene.lines[0].speakerJa ?? scene.lines[0].speaker ?? 'narrator'}:&nbsp;
                </span>
                <span style={{ fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', color: '#8080a0', lineHeight: 1.4 }}>
                  {scene.lines[0].text.substring(0, 80)}{scene.lines[0].text.length > 80 ? '…' : ''}
                </span>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p style={{ color: '#7878a8', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
            該当するシーンがありません
          </p>
        )}
      </div>
    </div>
  );
}
