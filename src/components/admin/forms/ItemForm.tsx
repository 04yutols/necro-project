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

const TABS = ['基本情報', 'サブオプション', 'パッシブ', '依存関係'];
const ITEM_TYPES = ['WEAPON', 'CONSUMABLE'];
const RARITIES = ['R', 'SR', 'SSR', 'UR'];
const ARCHETYPES = ['LOW', 'MID', 'HIGH', 'SPECIAL'];

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
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', minHeight: 80 };

type SubOption = { type: string; value: number };
type PassiveData = { nameJa: string; descTemplate: string; values: number[] };

type ItemFormState = {
  id: string;
  name: string;
  type: string;
  rarity: string;
  archetype: string;
  rank: number;
  ilv: number;
  isUnique: boolean;
  flavor: string;
  subOptions: SubOption[];
  passiveA: PassiveData;
  passiveB: PassiveData;
};

function formToJson(form: ItemFormState): Record<string, unknown> {
  return {
    id: form.id,
    name: form.name,
    type: form.type,
    rarity: form.rarity,
    weaponRarity: form.rarity,
    archetype: form.archetype,
    rank: form.rank,
    ilv: form.ilv,
    isUnique: form.isUnique,
    stats: {},
    subOptions: form.subOptions,
    passiveA: form.passiveA,
    passiveB: form.passiveB,
    flavor: form.flavor,
  };
}

function initPassive(data: Record<string, unknown> | undefined): PassiveData {
  if (!data) return { nameJa: '', descTemplate: '', values: [0, 0, 0, 0, 0] };
  return {
    nameJa: (data.nameJa as string) ?? '',
    descTemplate: (data.descTemplate as string) ?? '',
    values: (data.values as number[]) ?? [0, 0, 0, 0, 0],
  };
}

function initForm(data: Record<string, unknown> | null, key: string): ItemFormState {
  if (!data) {
    return {
      id: key,
      name: '',
      type: 'WEAPON',
      rarity: 'R',
      archetype: 'MID',
      rank: 1,
      ilv: 1,
      isUnique: false,
      flavor: '',
      subOptions: [],
      passiveA: { nameJa: '', descTemplate: '', values: [0, 0, 0, 0, 0] },
      passiveB: { nameJa: '', descTemplate: '', values: [0, 0, 0, 0, 0] },
    };
  }
  const raw = data as Record<string, unknown>;
  return {
    id: (raw.id as string) ?? key,
    name: (raw.name as string) ?? '',
    type: (raw.type as string) ?? 'WEAPON',
    rarity: (raw.rarity as string) ?? 'R',
    archetype: (raw.archetype as string) ?? 'MID',
    rank: (raw.rank as number) ?? 1,
    ilv: (raw.ilv as number) ?? 1,
    isUnique: (raw.isUnique as boolean) ?? false,
    flavor: (raw.flavor as string) ?? '',
    subOptions: (raw.subOptions as SubOption[]) ?? [],
    passiveA: initPassive(raw.passiveA as Record<string, unknown>),
    passiveB: initPassive(raw.passiveB as Record<string, unknown>),
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

export default function ItemForm({ initialData, entryKey, isNew, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<ItemFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof ItemFormState>(key: K, val: ItemFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  function updateSubOption(idx: number, patch: Partial<SubOption>) {
    setForm((f) => ({ ...f, subOptions: f.subOptions.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  }

  function updatePassive(which: 'passiveA' | 'passiveB', patch: Partial<PassiveData>) {
    setForm((f) => ({ ...f, [which]: { ...f[which], ...patch } }));
  }

  function updatePassiveValue(which: 'passiveA' | 'passiveB', idx: number, val: number) {
    setForm((f) => {
      const values = [...f[which].values];
      values[idx] = val;
      return { ...f, [which]: { ...f[which], values } };
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const result = await saveEntry('items', form.id || entryKey, formToJson(form));
    setSaving(false);
    if (result.success) router.push('/admin/items');
    else setError(result.error ?? '保存に失敗しました');
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('items', entryKey);
    setSaving(false);
    if (result.success) router.push('/admin/items');
    else setError(result.error ?? '削除に失敗しました');
  }

  function renderPassiveEditor(which: 'passiveA' | 'passiveB', label: string) {
    const p = form[which];
    return (
      <div style={{ padding: 14, background: 'rgba(139,0,255,0.04)', border: '1px solid rgba(139,0,255,0.1)', borderRadius: 8 }}>
        <p style={{ color: '#d8b4fe', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, marginBottom: 10 }}>{label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FormField label="nameJa"><input type="text" value={p.nameJa} onChange={(e) => updatePassive(which, { nameJa: e.target.value })} style={inputStyle} /></FormField>
          <FormField label="descTemplate（{value} でプレースホルダ）"><input type="text" value={p.descTemplate} onChange={(e) => updatePassive(which, { descTemplate: e.target.value })} style={inputStyle} /></FormField>
          <div>
            <label style={{ color: '#7878a8', fontSize: 11, display: 'block', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>values [Lv1 〜 Lv5]</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {p.values.map((v, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#7878a8', fontSize: 10, textAlign: 'center' }}>Lv{idx + 1}</span>
                  <input type="number" value={v} onChange={(e) => updatePassiveValue(which, idx, parseFloat(e.target.value) || 0)} step={0.1} style={{ ...inputStyle, padding: '6px 6px', textAlign: 'center' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/items"
        title={form.name || (isNew ? '新規アイテム' : entryKey)}
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
              <FormField label="name（アイテム名）">
                <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="type">
                  <select value={form.type} onChange={(e) => updateField('type', e.target.value)} style={selectStyle}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="rarity">
                  <select value={form.rarity} onChange={(e) => updateField('rarity', e.target.value)} style={selectStyle}>
                    {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>
                <FormField label="archetype">
                  <select value={form.archetype} onChange={(e) => updateField('archetype', e.target.value)} style={selectStyle}>
                    {ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="rank"><input type="number" value={form.rank} onChange={(e) => updateField('rank', parseInt(e.target.value) || 1)} min={1} style={inputStyle} /></FormField>
                <FormField label="ilv（アイテムレベル）"><input type="number" value={form.ilv} onChange={(e) => updateField('ilv', parseInt(e.target.value) || 1)} min={1} style={inputStyle} /></FormField>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" checked={form.isUnique} onChange={(e) => updateField('isUnique', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#8B00FF', cursor: 'pointer' }} id="isUnique" />
                <label htmlFor="isUnique" style={{ color: '#a5a9b4', fontSize: 13, cursor: 'pointer' }}>isUnique（ユニーク装備）</label>
              </div>
              <FormField label="flavor（フレーバーテキスト）">
                <textarea value={form.flavor} onChange={(e) => updateField('flavor', e.target.value)} style={textareaStyle} />
              </FormField>
            </div>
          )}

          {/* サブオプション */}
          {activeTab === 'サブオプション' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.subOptions.length === 0 ? (
                <p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>サブオプションなし</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', gap: 6, marginBottom: 4 }}>
                    {['type（ステータス種）', '値', ''].map((h) => (
                      <span key={h} style={{ color: '#7878a8', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>{h}</span>
                    ))}
                  </div>
                  {form.subOptions.map((opt, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 32px', gap: 6, alignItems: 'center' }}>
                      <input type="text" value={opt.type} onChange={(e) => updateSubOption(idx, { type: e.target.value })} style={inputStyle} placeholder="ATK%, CRIT_DMG..." />
                      <input type="number" value={opt.value} onChange={(e) => updateSubOption(idx, { value: parseFloat(e.target.value) || 0 })} step={0.1} style={inputStyle} />
                      <button onClick={() => updateField('subOptions', form.subOptions.filter((_, i) => i !== idx))} style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </>
              )}
              <button onClick={() => updateField('subOptions', [...form.subOptions, { type: 'ATK%', value: 0 }])} style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>+ 追加</button>
            </div>
          )}

          {/* パッシブ */}
          {activeTab === 'パッシブ' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderPassiveEditor('passiveA', 'Passive A')}
              {renderPassiveEditor('passiveB', 'Passive B')}
            </div>
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
