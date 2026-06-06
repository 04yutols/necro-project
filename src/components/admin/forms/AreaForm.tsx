'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteEntry, saveEntry } from '@/app/admin/actions';
import type { DependencyRef } from '@/app/admin/actions';
import ConfirmDialog from './shared/ConfirmDialog';
import DependenciesTab from './shared/DependenciesTab';
import FormField from './shared/FormField';
import FormSaveBar from './shared/FormSaveBar';
import FormTabs from './shared/FormTabs';
import JsonSidebar from './shared/JsonSidebar';

const TABS = ['基本情報', '表示設定', '依存関係'];

const inputStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid rgba(139,0,255,0.2)',
  borderRadius: 6,
  padding: '0 12px',
  height: 44,
  boxSizing: 'border-box',
  color: '#e0d0ff',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  fontFamily: 'monospace',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: undefined,
  resize: 'vertical',
  minHeight: 120,
  paddingTop: 10,
  paddingBottom: 10,
  lineHeight: 1.6,
};

type AreaFormState = {
  id: string;
  chapter: number;
  area: number;
  nameJa: string;
  nameEn: string;
  description: string;
  color: string;
  positionX: number;
  positionY: number;
  sortOrder: number;
};

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

function initForm(data: Record<string, unknown> | null, key: string): AreaFormState {
  if (!data) {
    return {
      id: key,
      chapter: 1,
      area: 1,
      nameJa: '',
      nameEn: '',
      description: '',
      color: '#8A2BE2',
      positionX: 188,
      positionY: 438,
      sortOrder: 101,
    };
  }
  const position = (data.position as Record<string, number>) ?? {};
  const chapter = (data.chapter as number) ?? 1;
  const area = (data.area as number) ?? 1;
  return {
    id: (data.id as string) ?? key,
    chapter,
    area,
    nameJa: (data.nameJa as string) ?? '',
    nameEn: (data.nameEn as string) ?? '',
    description: (data.description as string) ?? '',
    color: (data.color as string) ?? '#8A2BE2',
    positionX: position.x ?? 188,
    positionY: position.y ?? 438,
    sortOrder: (data.sortOrder as number) ?? chapter * 100 + area,
  };
}

function formToJson(form: AreaFormState): Record<string, unknown> {
  return {
    id: form.id,
    chapter: form.chapter,
    area: form.area,
    nameJa: form.nameJa,
    nameEn: form.nameEn,
    description: form.description,
    color: form.color,
    position: { x: form.positionX, y: form.positionY },
    sortOrder: form.sortOrder,
  };
}

export default function AreaForm({ initialData, entryKey, isNew, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<AreaFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const colorInputValue = /^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : '#8A2BE2';

  const updateField = useCallback(<K extends keyof AreaFormState>(key: K, value: AreaFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  }, []);

  async function handleConfirmedSave() {
    setSaving(true);
    setError(null);
    setShowSaveConfirm(false);
    const result = await saveEntry('areas', form.id || entryKey, formToJson(form));
    setSaving(false);
    if (result.success) {
      router.push('/admin/areas');
      router.refresh();
    } else {
      setError(result.error ?? '保存に失敗しました');
    }
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setError(null);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('areas', entryKey);
    setSaving(false);
    if (result.success) {
      router.push('/admin/areas');
      router.refresh();
    } else {
      setError(result.error ?? '削除に失敗しました');
    }
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/areas"
        title={form.nameJa || form.nameEn || (isNew ? '新規エリア' : entryKey)}
        onSave={() => setShowSaveConfirm(true)}
        onCopy={() => navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2))}
        onDelete={!isNew ? () => setShowDeleteConfirm(true) : undefined}
        saving={saving}
        isNew={isNew}
        entryKey={entryKey}
      />

      {error && (
        <div style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, padding: '10px 14px', color: '#fca5a5', fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div>
          <FormTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === '基本情報' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="ID（推奨: ch1_area1）">
                <input type="text" value={form.id} onChange={(event) => updateField('id', event.target.value)} disabled={!isNew} style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="chapter">
                  <input type="number" value={form.chapter} onChange={(event) => updateField('chapter', parseInt(event.target.value, 10) || 1)} min={1} style={inputStyle} />
                </FormField>
                <FormField label="area">
                  <input type="number" value={form.area} onChange={(event) => updateField('area', parseInt(event.target.value, 10) || 1)} min={1} style={inputStyle} />
                </FormField>
                <FormField label="sortOrder">
                  <input type="number" value={form.sortOrder} onChange={(event) => updateField('sortOrder', parseInt(event.target.value, 10) || 0)} style={inputStyle} />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="nameJa">
                  <input type="text" value={form.nameJa} onChange={(event) => updateField('nameJa', event.target.value)} style={inputStyle} />
                </FormField>
                <FormField label="nameEn">
                  <input type="text" value={form.nameEn} onChange={(event) => updateField('nameEn', event.target.value)} style={inputStyle} />
                </FormField>
              </div>
              <FormField label="description">
                <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} style={textareaStyle} />
              </FormField>
            </div>
          )}

          {activeTab === '表示設定' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, alignItems: 'end' }}>
                <FormField label="color">
                  <input type="color" value={colorInputValue} onChange={(event) => updateField('color', event.target.value.toUpperCase())} style={{ ...inputStyle, padding: 4 }} />
                </FormField>
                <FormField label="#RRGGBB">
                  <input type="text" value={form.color} onChange={(event) => updateField('color', event.target.value)} style={inputStyle} />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="world position.x">
                  <input type="number" value={form.positionX} onChange={(event) => updateField('positionX', parseInt(event.target.value, 10) || 0)} style={inputStyle} />
                </FormField>
                <FormField label="world position.y">
                  <input type="number" value={form.positionY} onChange={(event) => updateField('positionY', parseInt(event.target.value, 10) || 0)} style={inputStyle} />
                </FormField>
              </div>
              <div style={{
                borderRadius: 12,
                border: `1px solid ${form.color}66`,
                background: `linear-gradient(135deg, ${form.color}22, rgba(10,5,24,0.92))`,
                padding: 16,
                boxShadow: `0 0 24px ${form.color}22`,
              }}>
                <div style={{ fontFamily: 'Cinzel, serif', color: form.color, fontSize: 10, fontWeight: 900, letterSpacing: '0.14em' }}>{form.nameEn || 'AREA PREVIEW'}</div>
                <div style={{ marginTop: 5, color: '#f0ebff', fontSize: 22, fontWeight: 900 }}>{form.nameJa || 'エリア名'}</div>
                <div style={{ marginTop: 8, color: '#a89ec8', fontSize: 12, lineHeight: 1.6 }}>{form.description || '説明文プレビュー'}</div>
              </div>
            </div>
          )}

          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog open={showSaveConfirm} title="保存の確認" message={`"${form.id || entryKey}" を保存します。`} onConfirm={handleConfirmedSave} onCancel={() => setShowSaveConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title="削除の確認" message={`"${entryKey}" を削除します。この操作は取り消せません。`} onConfirm={handleConfirmedDelete} onCancel={() => setShowDeleteConfirm(false)} danger />
    </div>
  );
}
