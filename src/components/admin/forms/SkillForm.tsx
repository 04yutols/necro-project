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
import AISkillDraftPanel from '../AISkillDraftPanel';
import type { DependencyRef } from '@/app/admin/actions';

const TABS = ['フォーム', '依存関係'];

const SKILL_TYPES = ['PHYSICAL', 'MAGICAL', 'SUPPORT'];
const ELEMENTS = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'];
const ATTACK_TYPES = ['SLASH', 'PIERCE', 'BLUNT', 'MAGIC', 'NONE'];
const TARGET_TYPES = ['SINGLE', 'ALL_ENEMIES', 'SELF', 'PARTY', 'SINGLE_ALLY'];
const AILMENT_TYPES = ['POISON', 'BURN', 'FREEZE', 'PARALYSIS', 'BLIND', 'SLEEP', 'STUN', 'SILENCE'];

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
const textareaStyle: React.CSSProperties = { ...inputStyle, height: undefined, resize: 'vertical', minHeight: 96 };

type SkillFormState = {
  id: string;
  name: string;
  mpCost: number;
  power: number;
  type: string;
  element: string;
  attackType: string;
  targetType: string;
  effectKey: string;
  ailmentType: string;
  ailmentBaseRate: number;
  healSelfPct: number;
  description: string;
};

function formToJson(form: SkillFormState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: form.id,
    name: form.name,
    mpCost: form.mpCost,
    power: form.power,
    type: form.type,
    element: form.element,
    attackType: form.attackType,
    targetType: form.targetType,
    effectKey: form.effectKey,
    description: form.description,
  };
  if (form.ailmentType) {
    base.ailmentType = form.ailmentType;
    base.ailmentBaseRate = form.ailmentBaseRate;
  }
  if (form.healSelfPct > 0) base.healSelfPct = form.healSelfPct;
  return base;
}

function initForm(data: Record<string, unknown> | null, key: string): SkillFormState {
  if (!data) {
    return {
      id: key,
      name: '',
      mpCost: 5,
      power: 1.0,
      type: 'PHYSICAL',
      element: 'NONE',
      attackType: 'SLASH',
      targetType: 'SINGLE',
      effectKey: '',
      ailmentType: '',
      ailmentBaseRate: 0,
      healSelfPct: 0,
      description: '',
    };
  }
  const raw = data as Record<string, unknown>;
  return {
    id: (raw.id as string) ?? key,
    name: (raw.name as string) ?? '',
    mpCost: (raw.mpCost as number) ?? 5,
    power: (raw.power as number) ?? 1.0,
    type: (raw.type as string) ?? 'PHYSICAL',
    element: (raw.element as string) ?? 'NONE',
    attackType: (raw.attackType as string) ?? 'SLASH',
    targetType: (raw.targetType as string) ?? 'SINGLE',
    effectKey: (raw.effectKey as string) ?? '',
    ailmentType: (raw.ailmentType as string) ?? '',
    ailmentBaseRate: (raw.ailmentBaseRate as number) ?? 0,
    healSelfPct: (raw.healSelfPct as number) ?? 0,
    description: (raw.description as string) ?? '',
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

export default function SkillForm({ initialData, entryKey, isNew, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<SkillFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof SkillFormState>(key: K, val: SkillFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const result = await saveEntry('skills', form.id || entryKey, formToJson(form));
    setSaving(false);
    if (result.success) router.push('/admin/skills');
    else setError(result.error ?? '保存に失敗しました');
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('skills', entryKey);
    setSaving(false);
    if (result.success) router.push('/admin/skills');
    else setError(result.error ?? '削除に失敗しました');
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/skills"
        title={form.name || (isNew ? '新規スキル' : entryKey)}
        onSave={() => setShowSaveConfirm(true)}
        onCopy={handleCopy}
        onDelete={!isNew ? () => setShowDeleteConfirm(true) : undefined}
        saving={saving}
        isNew={isNew}
        entryKey={entryKey}
      />

      {isNew && (
        <AISkillDraftPanel
          onApply={(draft) => {
            const draftId = typeof draft.id === 'string' && draft.id ? draft.id : entryKey;
            setForm(initForm(draft, draftId));
            setActiveTab(TABS[0]);
            setError(null);
          }}
        />
      )}

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
          <FormField label="name（スキル名）">
            <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="mpCost">
              <input type="number" value={form.mpCost} onChange={(e) => updateField('mpCost', parseInt(e.target.value) || 0)} min={0} style={inputStyle} />
            </FormField>
            <FormField label="power（倍率）">
              <input type="number" value={form.power} onChange={(e) => updateField('power', parseFloat(e.target.value) || 0)} step={0.05} style={inputStyle} />
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <FormField label="type">
              <select value={form.type} onChange={(e) => updateField('type', e.target.value)} style={selectStyle}>
                {SKILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="element">
              <select value={form.element} onChange={(e) => updateField('element', e.target.value)} style={selectStyle}>
                {ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
              </select>
            </FormField>
            <FormField label="attackType">
              <select value={form.attackType} onChange={(e) => updateField('attackType', e.target.value)} style={selectStyle}>
                {ATTACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="targetType">
              <select value={form.targetType} onChange={(e) => updateField('targetType', e.target.value)} style={selectStyle}>
                {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
            <FormField label="effectKey">
              <input type="text" value={form.effectKey} onChange={(e) => updateField('effectKey', e.target.value)} style={inputStyle} />
            </FormField>
          </div>

          {/* Ailment */}
          <div style={{ padding: 12, background: 'rgba(139,0,255,0.04)', border: '1px solid rgba(139,0,255,0.1)', borderRadius: 8 }}>
            <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 10 }}>状態異常（任意）</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="ailmentType（空欄=なし）">
                <select value={form.ailmentType} onChange={(e) => updateField('ailmentType', e.target.value)} style={selectStyle}>
                  <option value="">-- なし --</option>
                  {AILMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              {form.ailmentType && (
                <FormField label="ailmentBaseRate (%)">
                  <input type="number" value={form.ailmentBaseRate} onChange={(e) => updateField('ailmentBaseRate', parseFloat(e.target.value) || 0)} min={0} max={100} step={1} style={inputStyle} />
                </FormField>
              )}
            </div>
          </div>

          <FormField label="healSelfPct（自己回復%、0=なし）">
            <input type="number" value={form.healSelfPct} onChange={(e) => updateField('healSelfPct', parseFloat(e.target.value) || 0)} min={0} step={1} style={inputStyle} />
          </FormField>
          <FormField label="description">
            <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} style={textareaStyle} />
          </FormField>
          </div>}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog open={showSaveConfirm} title="保存の確認" message={`"${form.id || entryKey}" を保存します。`} onConfirm={handleConfirmedSave} onCancel={() => setShowSaveConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title="削除の確認" message={`"${entryKey}" を削除します。`} onConfirm={handleConfirmedDelete} onCancel={() => setShowDeleteConfirm(false)} danger />
    </div>
  );
}
