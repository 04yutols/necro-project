'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntry, deleteEntry } from '@/app/admin/actions';
import FormTabs from './shared/FormTabs';
import FormSaveBar from './shared/FormSaveBar';
import FormField from './shared/FormField';
import JsonSidebar from './shared/JsonSidebar';
import ConfirmDialog from './shared/ConfirmDialog';
import DependenciesTab from './shared/DependenciesTab';
import type { DependencyRef } from '@/app/admin/actions';

const TABS = ['フォーム', '依存関係'];
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const inputStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid rgba(139,0,255,0.2)',
  borderRadius: 6,
  padding: '0 12px',
  height: 44,
  boxSizing: 'border-box' as const,
  color: '#e0d0ff',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  fontFamily: 'monospace',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

type MaterialFormState = {
  id: string;
  name: string;
  quantity: number;
  expValue: number;
  rarity: string;
};

function formToJson(form: MaterialFormState): Record<string, unknown> {
  return {
    id: form.id,
    name: form.name,
    quantity: form.quantity,
    expValue: form.expValue,
    rarity: form.rarity,
  };
}

function initForm(data: Record<string, unknown> | null, key: string): MaterialFormState {
  if (!data) {
    return { id: key, name: '', quantity: 1, expValue: 100, rarity: 'COMMON' };
  }
  const raw = data as Record<string, unknown>;
  return {
    id: (raw.id as string) ?? key,
    name: (raw.name as string) ?? '',
    quantity: (raw.quantity as number) ?? 1,
    expValue: (raw.expValue as number) ?? 100,
    rarity: (raw.rarity as string) ?? 'COMMON',
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

export default function MaterialForm({ initialData, entryKey, isNew, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<MaterialFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof MaterialFormState>(key: K, val: MaterialFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const result = await saveEntry('materials', form.id || entryKey, formToJson(form));
    setSaving(false);
    if (result.success) router.push('/admin/materials');
    else setError(result.error ?? '保存に失敗しました');
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('materials', entryKey);
    setSaving(false);
    if (result.success) router.push('/admin/materials');
    else setError(result.error ?? '削除に失敗しました');
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/materials"
        title={form.name || (isNew ? '新規素材' : entryKey)}
        onSave={() => setShowSaveConfirm(true)}
        onCopy={handleCopy}
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

          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}

          {activeTab === 'フォーム' && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="ID（キー）">
            <input type="text" value={form.id} onChange={(e) => updateField('id', e.target.value)} disabled={!isNew} style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }} />
          </FormField>
          <FormField label="name（素材名）">
            <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="quantity（個数）">
              <input type="number" value={form.quantity} onChange={(e) => updateField('quantity', parseInt(e.target.value) || 1)} min={1} style={inputStyle} />
            </FormField>
            <FormField label="expValue（EXP価値）">
              <input type="number" value={form.expValue} onChange={(e) => updateField('expValue', parseInt(e.target.value) || 0)} min={0} style={inputStyle} />
            </FormField>
            <FormField label="rarity">
              <select value={form.rarity} onChange={(e) => updateField('rarity', e.target.value)} style={selectStyle}>
                {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
          </div>
          </div>}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog open={showSaveConfirm} title="保存の確認" message={`"${form.id || entryKey}" を保存します。`} onConfirm={handleConfirmedSave} onCancel={() => setShowSaveConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title="削除の確認" message={`"${entryKey}" を削除します。`} onConfirm={handleConfirmedDelete} onCancel={() => setShowDeleteConfirm(false)} danger />
    </div>
  );
}
