'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntry, deleteEntry } from '@/app/admin/actions';
import FormTabs from './shared/FormTabs';
import FormSaveBar from './shared/FormSaveBar';
import FormField from './shared/FormField';
import StatInputGrid from './shared/StatInputGrid';
import ResistanceGrid from './shared/ResistanceGrid';
import JsonSidebar from './shared/JsonSidebar';
import ConfirmDialog from './shared/ConfirmDialog';
import DependenciesTab from './shared/DependenciesTab';
import type { DependencyRef } from '@/app/admin/actions';

const TABS = ['基本情報', 'ステータス', '属性耐性', '依存関係'];
const TRIBES = ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'];

const inputStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid rgba(139,0,255,0.2)',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#e0d0ff',
  fontSize: 13,
  width: '100%',
  outline: 'none',
  fontFamily: 'monospace',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

type MonsterFormState = {
  id: string;
  name: string;
  tribe: string;
  cost: number;
  stats: Record<string, number>;
  resistances: Record<string, number>;
};

function formToJson(form: MonsterFormState): Record<string, unknown> {
  const resistancesCleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(form.resistances)) {
    if (v !== 0) resistancesCleaned[k] = v;
  }
  return {
    name: form.name,
    tribe: form.tribe,
    cost: form.cost,
    stats: form.stats,
    resistances: resistancesCleaned,
  };
}

function initForm(data: Record<string, unknown> | null, key: string): MonsterFormState {
  if (!data) {
    return {
      id: key,
      name: '',
      tribe: 'UNDEAD',
      cost: 1,
      stats: { hp: 50, atk: 10, def: 5, spd: 80, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
      resistances: {},
    };
  }
  const raw = data as Record<string, unknown>;
  return {
    id: key,
    name: (raw.name as string) ?? '',
    tribe: (raw.tribe as string) ?? 'UNDEAD',
    cost: (raw.cost as number) ?? 1,
    stats: (raw.stats as Record<string, number>) ?? {},
    resistances: (raw.resistances as Record<string, number>) ?? {},
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

export default function MonsterForm({ initialData, entryKey, isNew, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<MonsterFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof MonsterFormState>(key: K, val: MonsterFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  const updateStat = useCallback((key: string, val: number) => {
    setForm((f) => ({ ...f, stats: { ...f.stats, [key]: val } }));
  }, []);

  const updateResistance = useCallback((el: string, val: number) => {
    setForm((f) => ({ ...f, resistances: { ...f.resistances, [el]: val } }));
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const saveKey = isNew ? (form.id || entryKey) : entryKey;
    const result = await saveEntry('monsters', saveKey, formToJson(form));
    setSaving(false);
    if (result.success) router.push('/admin/monsters');
    else setError(result.error ?? '保存に失敗しました');
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('monsters', entryKey);
    setSaving(false);
    if (result.success) router.push('/admin/monsters');
    else setError(result.error ?? '削除に失敗しました');
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/monsters"
        title={form.name || (isNew ? '新規モンスター' : entryKey)}
        onSave={() => setShowSaveConfirm(true)}
        onCopy={handleCopy}
        onDelete={!isNew ? () => setShowDeleteConfirm(true) : undefined}
        saving={saving}
        isNew={isNew}
        entryKey={entryKey}
      />

      {error && (
        <div style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, padding: '10px 14px', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div>
          <FormTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {/* 基本情報 */}
          {activeTab === '基本情報' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="ID（キー）">
                <input type="text" value={form.id} onChange={(e) => updateField('id', e.target.value)} disabled={!isNew} style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }} />
              </FormField>
              <FormField label="name（モンスター名）">
                <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="tribe（種族）">
                  <select value={form.tribe} onChange={(e) => updateField('tribe', e.target.value)} style={selectStyle}>
                    {TRIBES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="cost（1-5）">
                  <input type="number" value={form.cost} onChange={(e) => updateField('cost', parseInt(e.target.value) || 1)} min={1} max={5} style={inputStyle} />
                </FormField>
              </div>
            </div>
          )}

          {activeTab === 'ステータス' && (
            <StatInputGrid value={form.stats} onChange={updateStat} />
          )}

          {activeTab === '属性耐性' && (
            <ResistanceGrid value={form.resistances} onChange={updateResistance} />
          )}

          {/* 依存関係 */}
          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog open={showSaveConfirm} title="保存の確認" message={`"${form.id || entryKey}" を保存します。`} onConfirm={handleConfirmedSave} onCancel={() => setShowSaveConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title="削除の確認" message={`"${entryKey}" を削除します。`} onConfirm={handleConfirmedDelete} onCancel={() => setShowDeleteConfirm(false)} danger />
    </div>
  );
}
