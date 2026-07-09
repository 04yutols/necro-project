'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveStoryScene, deleteStoryScene } from '@/app/admin/actions';
import FormTabs from './shared/FormTabs';
import FormSaveBar from './shared/FormSaveBar';
import FormField from './shared/FormField';
import ConfirmDialog from './shared/ConfirmDialog';
import AIStorySceneCandidates from '../AIStorySceneCandidates';
import type { StoryScene, StoryCharacter, DialogueLine, CharacterPortrait, SceneTrigger } from '@/types/story';

// ── Constants ─────────────────────────────────────────────────────────────────

const SCENE_TYPES = ['DIALOGUE', 'MONOLOGUE', 'ENVIRONMENT', 'CHAPTER_TITLE'] as const;
const BACKGROUNDS = ['DARK', 'SEPIA', 'BLOOD_RED', 'RUIN_LIGHT', 'BLUR_MAP', 'STAGE_DARK'];
const TRIGGER_TYPES = [
  'GAME_START', 'FLAG_SET', 'STAGE_CLEAR', 'STAGE_ENTER',
  'AREA_UNLOCK', 'BOSS_CLEAR', 'DEMONIZE_FIRST', 'MANUAL',
] as const;
const POSITIONS = ['LEFT', 'CENTER', 'RIGHT'] as const;
const VFX_OPTIONS = ['', 'soulChain', 'cursedPillarBreath', 'demonRingConverge', 'ssrGoldPillar'];
const TABS = ['基本情報', '台詞編集', '完了アクション'];

// ── Shared input styles ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 44, background: '#0d0d14',
  border: '1px solid rgba(139,0,255,0.25)', borderRadius: 8,
  padding: '0 12px', color: '#e0d0ff', fontSize: 14,
  width: '100%', outline: 'none', fontFamily: 'monospace',
  boxSizing: 'border-box' as const,
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = {
  ...inputStyle, height: undefined, resize: 'vertical', minHeight: 96,
  padding: '10px 12px', lineHeight: 1.6,
};

// ── Helper: empty line ────────────────────────────────────────────────────────

function emptyLine(): DialogueLine {
  return { speaker: 'narrator', text: '' };
}

// ── Sub-component: Portrait row ───────────────────────────────────────────────

function PortraitRow({
  portrait,
  characterIds,
  characterMap,
  onChange,
  onRemove,
}: {
  portrait: CharacterPortrait;
  characterIds: string[];
  characterMap: Record<string, StoryCharacter>;
  onChange: (p: CharacterPortrait) => void;
  onRemove: () => void;
}) {
  const char = characterMap[portrait.characterId];
  const expressions = char?.expressions ?? [];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
      gap: 8, alignItems: 'center',
      background: '#0a0a12', border: '1px solid rgba(139,0,255,0.12)',
      borderRadius: 8, padding: '10px 12px',
    }}>
      <select
        value={portrait.characterId}
        onChange={(e) => onChange({ ...portrait, characterId: e.target.value, expression: 'default' })}
        style={{ ...selectStyle, height: 38 }}
      >
        {characterIds.map((id) => (
          <option key={id} value={id} style={{ background: '#0d0d14' }}>
            {characterMap[id]?.nameJa ?? id}
          </option>
        ))}
      </select>
      <select
        value={portrait.position}
        onChange={(e) => onChange({ ...portrait, position: e.target.value as CharacterPortrait['position'] })}
        style={{ ...selectStyle, height: 38 }}
      >
        {POSITIONS.map((p) => <option key={p} value={p} style={{ background: '#0d0d14' }}>{p}</option>)}
      </select>
      <select
        value={portrait.expression}
        onChange={(e) => onChange({ ...portrait, expression: e.target.value })}
        style={{ ...selectStyle, height: 38 }}
      >
        {(expressions.length > 0 ? expressions : ['default']).map((ex) => (
          <option key={ex} value={ex} style={{ background: '#0d0d14' }}>{ex}</option>
        ))}
      </select>
      <button
        onClick={onRemove}
        style={{
          height: 38, width: 38, borderRadius: 8,
          background: 'rgba(220,38,38,0.12)',
          border: '1px solid rgba(220,38,38,0.3)',
          color: '#fca5a5', cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ── Sub-component: Line editor card ──────────────────────────────────────────

function LineCard({
  line,
  index,
  total,
  characterIds,
  characterMap,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  line: DialogueLine;
  index: number;
  total: number;
  characterIds: string[];
  characterMap: Record<string, StoryCharacter>;
  onChange: (l: DialogueLine) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(139,0,255,0.18)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 14px', minHeight: 48,
        borderBottom: expanded ? '1px solid rgba(139,0,255,0.1)' : 'none',
        background: '#0d0d14',
      }}>
        <span style={{ fontSize: 12, color: '#555570', fontFamily: 'Space Mono, monospace', flexShrink: 0, width: 24 }}>
          {index + 1}
        </span>
        <span style={{
          flex: 1, fontSize: 13, color: '#a080d0',
          fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {line.speakerJa || line.speaker || 'narrator'} — {line.text.substring(0, 40) || '（テキスト未入力）'}
        </span>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onMoveUp} disabled={index === 0} style={{
            height: 30, width: 30, borderRadius: 6,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: index === 0 ? '#333350' : '#9090b0', cursor: index === 0 ? 'default' : 'pointer',
            fontSize: 13,
          }}>↑</button>
          <button onClick={onMoveDown} disabled={index === total - 1} style={{
            height: 30, width: 30, borderRadius: 6,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: index === total - 1 ? '#333350' : '#9090b0', cursor: index === total - 1 ? 'default' : 'pointer',
            fontSize: 13,
          }}>↓</button>
          <button onClick={() => setExpanded((v) => !v)} style={{
            height: 30, padding: '0 10px', borderRadius: 6,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#9090b0', cursor: 'pointer', fontSize: 12,
          }}>
            {expanded ? '折りたたむ' : '展開'}
          </button>
          <button onClick={onRemove} style={{
            height: 30, width: 30, borderRadius: 6,
            background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
            color: '#fca5a5', cursor: 'pointer', fontSize: 16,
          }}>×</button>
        </div>
      </div>

      {/* Card body */}
      {expanded && (
        <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Speaker */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="話者 ID (speaker)">
              <select
                value={line.speaker ?? 'narrator'}
                onChange={(e) => onChange({ ...line, speaker: e.target.value })}
                style={selectStyle}
              >
                <option value="narrator" style={{ background: '#0d0d14' }}>narrator</option>
                {characterIds.filter((id) => id !== 'narrator').map((id) => (
                  <option key={id} value={id} style={{ background: '#0d0d14' }}>
                    {characterMap[id]?.nameJa ?? id} ({id})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="表示名 (speakerJa) ※ナレーターは空でOK">
              <input
                type="text"
                value={line.speakerJa ?? ''}
                onChange={(e) => onChange({ ...line, speakerJa: e.target.value || undefined })}
                placeholder="例: アルド"
                style={inputStyle}
              />
            </FormField>
          </div>

          {/* Text */}
          <FormField label="本文 (text) ※ \\n で改行">
            <textarea
              value={line.text}
              onChange={(e) => onChange({ ...line, text: e.target.value })}
              style={textareaStyle}
            />
          </FormField>
          <FormField label="英語テキスト (textEn) ※任意">
            <textarea
              value={line.textEn ?? ''}
              onChange={(e) => onChange({ ...line, textEn: e.target.value || undefined })}
              style={{ ...textareaStyle, minHeight: 60 }}
            />
          </FormField>

          {/* Portraits */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ color: '#a0a0c0', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 500 }}>
                ポートレート（最大3体）
              </label>
              {(line.portraits?.length ?? 0) < 3 && (
                <button
                  onClick={() => onChange({
                    ...line,
                    portraits: [...(line.portraits ?? []), {
                      characterId: characterIds[0] ?? 'aldo',
                      position: 'LEFT',
                      expression: 'default',
                    }],
                  })}
                  style={{
                    height: 32, padding: '0 14px', borderRadius: 6,
                    background: 'rgba(139,0,255,0.12)',
                    border: '1px solid rgba(139,0,255,0.3)',
                    color: '#a78bfa', cursor: 'pointer', fontSize: 12,
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  + キャラ追加
                </button>
              )}
            </div>
            {line.portraits && line.portraits.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto',
                  gap: 8, padding: '4px 12px',
                }}>
                  {['キャラクター', 'ポジション', '表情', ''].map((h) => (
                    <span key={h} style={{ fontSize: 11, color: '#555570', fontFamily: 'Space Grotesk, sans-serif' }}>{h}</span>
                  ))}
                </div>
                {line.portraits.map((p, pi) => (
                  <PortraitRow
                    key={pi}
                    portrait={p}
                    characterIds={characterIds.filter((id) => id !== 'narrator')}
                    characterMap={characterMap}
                    onChange={(np) => {
                      const next = [...(line.portraits ?? [])];
                      next[pi] = np;
                      onChange({ ...line, portraits: next });
                    }}
                    onRemove={() => {
                      const next = [...(line.portraits ?? [])];
                      next.splice(pi, 1);
                      onChange({ ...line, portraits: next.length > 0 ? next : undefined });
                    }}
                  />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#555570', fontFamily: 'Space Grotesk, sans-serif' }}>
                ポートレートなし（MONOLOGUE / ENVIRONMENT に適切）
              </p>
            )}
          </div>

          {/* Optional fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="VFX">
              <select
                value={line.vfx ?? ''}
                onChange={(e) => onChange({ ...line, vfx: e.target.value || undefined })}
                style={selectStyle}
              >
                {VFX_OPTIONS.map((v) => (
                  <option key={v} value={v} style={{ background: '#0d0d14' }}>{v || 'なし'}</option>
                ))}
              </select>
            </FormField>
            <FormField label="BGM キー ※任意">
              <input
                type="text"
                value={line.bgm ?? ''}
                onChange={(e) => onChange({ ...line, bgm: e.target.value || undefined })}
                style={inputStyle}
              />
            </FormField>
            <FormField label="待機時間 ms ※任意">
              <input
                type="number"
                value={line.pauseAfter ?? ''}
                onChange={(e) => onChange({ ...line, pauseAfter: e.target.value ? Number(e.target.value) : undefined })}
                style={inputStyle}
                min={0}
                step={100}
              />
            </FormField>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trigger editor ────────────────────────────────────────────────────────────

function TriggerEditor({
  trigger,
  onChange,
}: {
  trigger: SceneTrigger;
  onChange: (t: SceneTrigger) => void;
}) {
  const type = trigger.type;

  function onTypeChange(newType: typeof TRIGGER_TYPES[number]) {
    switch (newType) {
      case 'GAME_START': onChange({ type: 'GAME_START' }); break;
      case 'DEMONIZE_FIRST': onChange({ type: 'DEMONIZE_FIRST' }); break;
      case 'FLAG_SET': onChange({ type: 'FLAG_SET', flagKey: '' }); break;
      case 'STAGE_CLEAR': onChange({ type: 'STAGE_CLEAR', stageId: '' }); break;
      case 'STAGE_ENTER': onChange({ type: 'STAGE_ENTER', stageId: '' }); break;
      case 'AREA_UNLOCK': onChange({ type: 'AREA_UNLOCK', areaId: '' }); break;
      case 'BOSS_CLEAR': onChange({ type: 'BOSS_CLEAR', bossStageId: '' }); break;
      case 'MANUAL': onChange({ type: 'MANUAL', sceneId: '' }); break;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FormField label="トリガータイプ">
        <select
          value={type}
          onChange={(e) => onTypeChange(e.target.value as typeof TRIGGER_TYPES[number])}
          style={selectStyle}
        >
          {TRIGGER_TYPES.map((t) => (
            <option key={t} value={t} style={{ background: '#0d0d14' }}>{t}</option>
          ))}
        </select>
      </FormField>
      {'flagKey' in trigger && (
        <FormField label="flagKey">
          <input
            type="text"
            value={trigger.flagKey}
            onChange={(e) => onChange({ type: 'FLAG_SET', flagKey: e.target.value })}
            placeholder="例: LINE_DEATH_SEEN"
            style={inputStyle}
          />
        </FormField>
      )}
      {'stageId' in trigger && (
        <FormField label="stageId">
          <input
            type="text"
            value={trigger.stageId}
            onChange={(e) => onChange({ ...(trigger as { type: 'STAGE_CLEAR'; stageId: string }), stageId: e.target.value })}
            placeholder="例: area1_node1"
            style={inputStyle}
          />
        </FormField>
      )}
      {'bossStageId' in trigger && (
        <FormField label="bossStageId">
          <input
            type="text"
            value={trigger.bossStageId}
            onChange={(e) => onChange({ type: 'BOSS_CLEAR', bossStageId: e.target.value })}
            placeholder="例: area1_boss"
            style={inputStyle}
          />
        </FormField>
      )}
      {'areaId' in trigger && (
        <FormField label="areaId">
          <input
            type="text"
            value={trigger.areaId}
            onChange={(e) => onChange({ type: 'AREA_UNLOCK', areaId: e.target.value })}
            placeholder="例: area2"
            style={inputStyle}
          />
        </FormField>
      )}
      {'sceneId' in trigger && (
        <FormField label="sceneId">
          <input
            type="text"
            value={trigger.sceneId}
            onChange={(e) => onChange({ type: 'MANUAL', sceneId: e.target.value })}
            placeholder="例: PROLOGUE_03"
            style={inputStyle}
          />
        </FormField>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function StorySceneForm({
  scene,
  isNew,
  characters,
}: {
  scene: StoryScene;
  isNew: boolean;
  characters: Record<string, StoryCharacter>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<StoryScene>(scene);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [saving, setSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const characterIds = Object.keys(characters);

  const updateField = useCallback(<K extends keyof StoryScene>(key: K, val: StoryScene[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await saveStoryScene(form);
    setSaving(false);
    if (res.success) {
      router.push('/admin/story');
      router.refresh();
    } else {
      alert(`保存に失敗しました: ${res.error}`);
    }
  }

  async function handleDelete() {
    const res = await deleteStoryScene(form.id);
    if (res.success) {
      router.push('/admin/story');
      router.refresh();
    } else {
      alert(`削除に失敗しました: ${res.error}`);
    }
  }

  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  }

  function updateLine(i: number, updated: DialogueLine) {
    setForm((f) => {
      const next = [...f.lines];
      next[i] = updated;
      return { ...f, lines: next };
    });
  }

  function removeLine(i: number) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  function moveLine(i: number, dir: 1 | -1) {
    setForm((f) => {
      const next = [...f.lines];
      const j = i + dir;
      if (j < 0 || j >= next.length) return f;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...f, lines: next };
    });
  }

  const isChapterTitle = form.type === 'CHAPTER_TITLE';

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <FormSaveBar
        backHref="/admin/story"
        title={isNew ? '新規シーン' : `シーン編集: ${form.id}`}
        onSave={handleSave}
        onCopy={() => navigator.clipboard.writeText(JSON.stringify(form, null, 2))}
        onDelete={isNew ? undefined : () => setShowDeleteDialog(true)}
        saving={saving}
        isNew={isNew}
        entryKey={form.id}
      />

      <AIStorySceneCandidates
        currentScene={form}
        isNew={isNew}
        onApply={(lines) => {
          setForm((f) => ({ ...f, lines }));
          setActiveTab('台詞編集');
        }}
      />

      <FormTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* ① 基本情報 */}
      {activeTab === '基本情報' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <FormField label="シーン ID">
              <input type="text" value={form.id} onChange={(e) => updateField('id', e.target.value)}
                placeholder="例: CH1_NODE1_AFTER" disabled={!isNew}
                style={{ ...inputStyle, opacity: isNew ? 1 : 0.6, cursor: isNew ? 'text' : 'not-allowed' }}
              />
            </FormField>
            <FormField label="sequence (表示順)">
              <input type="number" value={form.sequence ?? ''} onChange={(e) => updateField('sequence', Number(e.target.value))} style={inputStyle} min={0} />
            </FormField>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <FormField label="シーンタイプ">
              <select value={form.type} onChange={(e) => updateField('type', e.target.value as StoryScene['type'])} style={selectStyle}>
                {SCENE_TYPES.map((t) => <option key={t} value={t} style={{ background: '#0d0d14' }}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="背景">
              <select value={form.background ?? 'DARK'} onChange={(e) => updateField('background', e.target.value)} style={selectStyle}>
                {BACKGROUNDS.map((b) => <option key={b} value={b} style={{ background: '#0d0d14' }}>{b}</option>)}
              </select>
            </FormField>
            <FormField label="アーカイブ章番号">
              <input type="number" value={form.archiveChapter} onChange={(e) => updateField('archiveChapter', Number(e.target.value))} style={inputStyle} min={0} />
            </FormField>
          </div>

          <FormField label="アーカイブタイトル (archiveTitle)">
            <input type="text" value={form.archiveTitle} onChange={(e) => updateField('archiveTitle', e.target.value)} style={inputStyle} />
          </FormField>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#0d0d14', border: '1px solid rgba(139,0,255,0.15)', borderRadius: 8 }}>
            <input
              type="checkbox"
              id="isSkippable"
              checked={form.isSkippable}
              onChange={(e) => updateField('isSkippable', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#8B00FF', cursor: 'pointer' }}
            />
            <label htmlFor="isSkippable" style={{ fontSize: 14, color: '#d0c0f0', fontFamily: 'Space Grotesk, sans-serif', cursor: 'pointer' }}>
              スキップ可能（isSkippable）
            </label>
          </div>

          {/* CHAPTER_TITLE fields */}
          {isChapterTitle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#fbbf24', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>CHAPTER_TITLE 専用フィールド</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <FormField label="タイトル (title)">
                  <input type="text" value={form.title ?? ''} onChange={(e) => updateField('title', e.target.value || undefined)} placeholder="例: 亡 国 の 王 都" style={inputStyle} />
                </FormField>
                <FormField label="英語タイトル (titleEn)">
                  <input type="text" value={form.titleEn ?? ''} onChange={(e) => updateField('titleEn', e.target.value || undefined)} placeholder="例: FALLEN ROYAL CAPITAL" style={inputStyle} />
                </FormField>
              </div>
              <FormField label="チャプター説明 (description)">
                <textarea value={form.description ?? ''} onChange={(e) => updateField('description', e.target.value || undefined)} style={textareaStyle} placeholder="章の概要文" />
              </FormField>
            </div>
          )}

          {/* Trigger */}
          <div style={{ padding: '16px', background: '#0d0d14', border: '1px solid rgba(139,0,255,0.18)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#8B00FF', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, marginBottom: 14, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              トリガー設定
            </div>
            <TriggerEditor trigger={form.trigger} onChange={(t) => updateField('trigger', t)} />
          </div>
        </div>
      )}

      {/* ② 台詞編集 */}
      {activeTab === '台詞編集' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: '#9090b0', fontFamily: 'Space Grotesk, sans-serif' }}>
              {form.lines.length} 行
            </span>
            <button
              onClick={addLine}
              style={{
                height: 40, padding: '0 20px', borderRadius: 8,
                background: 'rgba(139,0,255,0.15)',
                border: '1px solid rgba(139,0,255,0.4)',
                color: '#d8b4fe', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              + 台詞を追加
            </button>
          </div>

          {form.lines.length === 0 ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center',
              background: '#0d0d14', border: '1px dashed rgba(139,0,255,0.2)', borderRadius: 10,
            }}>
              <p style={{ color: '#7878a8', fontSize: 14, fontFamily: 'Space Grotesk, sans-serif' }}>
                台詞がありません
              </p>
              <p style={{ color: '#555570', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', marginTop: 4 }}>
                CHAPTER_TITLE / 一部の ENVIRONMENT タイプはテキストなしでも正常動作します
              </p>
            </div>
          ) : (
            form.lines.map((line, i) => (
              <LineCard
                key={i}
                line={line}
                index={i}
                total={form.lines.length}
                characterIds={characterIds}
                characterMap={characters}
                onChange={(l) => updateLine(i, l)}
                onRemove={() => removeLine(i)}
                onMoveUp={() => moveLine(i, -1)}
                onMoveDown={() => moveLine(i, 1)}
              />
            ))
          )}
        </div>
      )}

      {/* ③ 完了アクション */}
      {activeTab === '完了アクション' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 13, color: '#7878a8', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1.6 }}>
            シーン終了後に実行するアクションを設定します。<br />
            全フィールド任意。不要な場合は空にしてください。
          </p>
          <FormField label="フラグをセット (setFlag) 例: LINE_DEATH_SEEN">
            <input
              type="text"
              value={form.onComplete?.setFlag ?? ''}
              onChange={(e) => updateField('onComplete', e.target.value
                ? { ...form.onComplete, setFlag: e.target.value }
                : { ...form.onComplete, setFlag: undefined }
              )}
              placeholder="例: CH1_STARTED"
              style={inputStyle}
            />
          </FormField>
          <FormField label="エリア解放 (unlockArea)">
            <input
              type="text"
              value={form.onComplete?.unlockArea ?? ''}
              onChange={(e) => updateField('onComplete', e.target.value
                ? { ...form.onComplete, unlockArea: e.target.value }
                : { ...form.onComplete, unlockArea: undefined }
              )}
              placeholder="例: area2"
              style={inputStyle}
            />
          </FormField>
          <FormField label="画面遷移 (navigateTo)">
            <input
              type="text"
              value={form.onComplete?.navigateTo ?? ''}
              onChange={(e) => updateField('onComplete', e.target.value
                ? { ...form.onComplete, navigateTo: e.target.value }
                : { ...form.onComplete, navigateTo: undefined }
              )}
              placeholder="例: HOME"
              style={inputStyle}
            />
          </FormField>

          {/* Current state preview */}
          {form.onComplete && Object.values(form.onComplete).some(Boolean) && (
            <div style={{
              padding: '12px 14px', background: '#0d0d14',
              border: '1px solid rgba(139,0,255,0.15)', borderRadius: 8,
              fontFamily: 'Space Mono, monospace', fontSize: 12, color: '#a078d0',
            }}>
              <pre style={{ margin: 0 }}>{JSON.stringify(
                Object.fromEntries(Object.entries(form.onComplete ?? {}).filter(([, v]) => v)),
                null, 2
              )}</pre>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={showDeleteDialog}
        title="シーンを削除"
        message={`「${form.id}」を削除します。この操作は取り消せません。`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
        danger
      />
    </div>
  );
}
