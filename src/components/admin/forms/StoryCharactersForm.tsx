'use client';

import { useState } from 'react';
import { deleteStoryCharacter, saveStoryCharacter } from '@/app/admin/actions';
import FormField from './shared/FormField';
import type { StoryCharacter } from '@/types/story';

const inputStyle: React.CSSProperties = {
  height: 44, background: '#0d0d14',
  border: '1px solid rgba(139,0,255,0.25)', borderRadius: 8,
  padding: '0 12px', color: '#e0d0ff', fontSize: 14,
  width: '100%', outline: 'none', fontFamily: 'monospace',
  boxSizing: 'border-box',
};

function CharacterCard({
  character,
  onSaved,
  onDeleted,
}: {
  character: StoryCharacter;
  onSaved: (c: StoryCharacter) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<StoryCharacter>(character);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expressionInput, setExpressionInput] = useState(character.expressions.join(', '));

  function update<K extends keyof StoryCharacter>(key: K, val: StoryCharacter[K]) {
    setForm((f) => ({ ...f, [key]: val }));
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    const expressions = expressionInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const updated = { ...form, expressions };
    setSaving(true);
    setError(null);
    const res = await saveStoryCharacter(updated);
    setSaving(false);
    if (res.success) {
      setSaved(true);
      onSaved(updated);
    } else {
      setError(res.error ?? '保存に失敗しました');
    }
  }

  async function handleDelete() {
    if (isNarrator) return;
    if (!window.confirm(`${form.nameJa || form.id} を削除しますか？`)) return;
    setDeleting(true);
    setError(null);
    const res = await deleteStoryCharacter(form.id);
    setDeleting(false);
    if (res.success) {
      onDeleted(form.id);
    } else {
      setError(res.error ?? '削除に失敗しました');
    }
  }

  const isNarrator = character.id === 'narrator';

  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(139,0,255,0.18)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        background: '#0d0d14',
        borderBottom: '1px solid rgba(139,0,255,0.12)',
      }}>
        {/* Color swatch */}
        <div style={{
          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
          background: form.color,
          boxShadow: `0 0 12px ${form.glow}`,
          border: '1px solid rgba(255,255,255,0.12)',
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, color: '#e0d0ff' }}>
            {form.nameJa || form.id}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: '#8B00FF', marginTop: 2 }}>
            {form.id}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          style={{
            height: 38, padding: '0 22px', borderRadius: 8,
            background: saved
              ? 'rgba(74,222,128,0.15)'
              : 'rgba(139,0,255,0.2)',
            border: `1px solid ${saved ? 'rgba(74,222,128,0.4)' : 'rgba(139,0,255,0.5)'}`,
            color: saved ? '#86efac' : '#d8b4fe',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600,
            fontFamily: 'Space Grotesk, sans-serif',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '保存中…' : saved ? '保存済み ✓' : '保存'}
        </button>
        {!isNarrator && (
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            style={{
              height: 38, padding: '0 14px', borderRadius: 8,
              background: 'rgba(127,29,29,0.22)',
              border: '1px solid rgba(220,38,38,0.4)',
              color: '#fca5a5',
              cursor: saving || deleting ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              opacity: saving || deleting ? 0.7 : 1,
            }}
          >
            {deleting ? '削除中…' : '削除'}
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(127,29,29,0.22)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 12 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FormField label="日本語名 (nameJa)">
            <input
              type="text"
              value={form.nameJa}
              onChange={(e) => update('nameJa', e.target.value)}
              style={inputStyle}
              placeholder="例: アルド"
              disabled={isNarrator}
            />
          </FormField>
          <FormField label="英語名 (nameEn)">
            <input
              type="text"
              value={form.nameEn}
              onChange={(e) => update('nameEn', e.target.value)}
              style={inputStyle}
              placeholder="例: Aldo"
              disabled={isNarrator}
            />
          </FormField>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <FormField label="テキスト色 (color)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={form.color}
                onChange={(e) => update('color', e.target.value)}
                style={{ height: 44, width: 52, borderRadius: 8, border: '1px solid rgba(139,0,255,0.25)', background: '#0d0d14', cursor: 'pointer', flexShrink: 0, padding: 4 }}
                disabled={isNarrator}
              />
              <input
                type="text"
                value={form.color}
                onChange={(e) => update('color', e.target.value)}
                style={{ ...inputStyle }}
                placeholder="#B09FF8"
                disabled={isNarrator}
              />
            </div>
          </FormField>
          <FormField label="グロー色 (glow)">
            <input
              type="text"
              value={form.glow}
              onChange={(e) => update('glow', e.target.value)}
              style={inputStyle}
              placeholder="rgba(176,159,248,0.55)"
              disabled={isNarrator}
            />
          </FormField>
          <FormField label="立ち絵パス (portraitBase)">
            <input
              type="text"
              value={form.portraitBase}
              onChange={(e) => update('portraitBase', e.target.value)}
              style={inputStyle}
              placeholder="/images/story/aldo"
              disabled={isNarrator}
            />
          </FormField>
        </div>

        <FormField label="表情リスト (カンマ区切り)">
          <input
            type="text"
            value={expressionInput}
            onChange={(e) => {
              setExpressionInput(e.target.value);
              setSaved(false);
            }}
            style={inputStyle}
            placeholder="default, smile, sad, angry"
            disabled={isNarrator}
          />
          {!isNarrator && (
            <p style={{ marginTop: 4, fontSize: 11, color: '#555570', fontFamily: 'Space Grotesk, sans-serif' }}>
              保存時にカンマで分割して配列に変換されます
            </p>
          )}
        </FormField>

        {!isNarrator && (
          <div style={{
            padding: '10px 14px', background: '#0a0a12',
            border: '1px solid rgba(139,0,255,0.12)', borderRadius: 8,
            display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Grotesk, sans-serif', marginRight: 4 }}>表情プレビュー:</span>
            {form.expressions.map((ex) => (
              <span key={ex} style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 11,
                background: 'rgba(139,0,255,0.1)', border: '1px solid rgba(139,0,255,0.25)',
                color: form.color, fontFamily: 'Space Mono, monospace',
              }}>
                {ex}
              </span>
            ))}
            {form.expressions.length === 0 && (
              <span style={{ fontSize: 11, color: '#555570', fontFamily: 'Space Grotesk, sans-serif' }}>なし</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoryCharactersForm({
  characters,
}: {
  characters: Record<string, StoryCharacter>;
}) {
  const [chars, setChars] = useState(characters);

  function handleSaved(updated: StoryCharacter) {
    setChars((prev) => ({ ...prev, [updated.id]: updated }));
  }

  function handleDeleted(id: string) {
    setChars((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const entries = Object.values(chars).sort((a, b) => {
    if (a.id === 'narrator') return 1;
    if (b.id === 'narrator') return -1;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <a
          href="/admin/story"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 38, padding: '0 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8080a0', textDecoration: 'none',
            fontFamily: 'Space Grotesk, sans-serif', fontSize: 13,
          }}
        >
          ← ストーリー
        </a>
        <div>
          <h1 style={{ fontSize: 20, fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#e0d0ff', margin: 0 }}>
            キャラクター管理
          </h1>
          <p style={{ fontSize: 12, color: '#7878a8', fontFamily: 'Space Grotesk, sans-serif', margin: '4px 0 0' }}>
            {entries.length} キャラクター — characters.json
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {entries.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        ))}
      </div>
    </div>
  );
}
