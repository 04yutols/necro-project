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
import AIDemonFormDraftPanel from '../AIDemonFormDraftPanel';
import type { DependencyRef } from '@/app/admin/actions';

const TABS = ['基本情報', 'Effect A', 'Effect B', '奥義', '依存関係'];
const RISK_TYPES = ['null', 'SELF_DAMAGE', 'HP_DRAIN'];
const ELEMENTS = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'];
const TARGET_TYPES = ['SINGLE', 'ALL', 'ALL_ENEMIES', 'PARTY'];
const ATTACK_TYPES = ['SLASH', 'PIERCE', 'BLUNT', 'MAGIC'];
const LINGERING_TYPES = ['PARTY_BUFF', 'ENEMY_DEBUFF', 'FIELD', 'SELF_BUFF'];
const ALL_FLAGS = ['DARK_EDGE', 'ELEMENT_SURGE', 'DRAIN_STRIKE', 'SWIFT_BLOOD', 'SHIELD_REND', 'LIFE_DRAIN', 'SHADOW_STEP', 'ELEMENT_ECHO', 'CURSE_CHANNEL'];
const STAT_BOOST_KEYS = ['atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'];

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

type StatBoostRow = { key: string; value: number };

type DemonFormState = {
  jobId: string;
  formName: string;
  tier: number;
  concept: string;
  effectA: {
    descJa: string;
    statBoosts: StatBoostRow[];
    flags: string[];
  };
  effectB: {
    descJa: string;
    riskType: string;
    onAttackEffect: string;
  };
  ultimateName: string;
  ultimatePower: number;
  ultimateElement: string;
  ultimateTargetType: string;
  ultimateAttackType: string;
  ultimateFlags: string[];
  lingeringType: string;
  lingeringDescJa: string;
  lingeringDuration: number;
};

function formToJson(form: DemonFormState): Record<string, unknown> {
  const statBoostsObj: Record<string, number> = {};
  for (const row of form.effectA.statBoosts) {
    if (row.key) statBoostsObj[row.key] = row.value;
  }
  return {
    jobId: form.jobId,
    formName: form.formName,
    tier: form.tier,
    concept: form.concept,
    effectA: {
      descJa: form.effectA.descJa,
      statBoosts: statBoostsObj,
      flags: form.effectA.flags,
    },
    effectB: {
      descJa: form.effectB.descJa,
      riskType: form.effectB.riskType === 'null' ? null : form.effectB.riskType,
      onAttackEffect: form.effectB.onAttackEffect,
    },
    ultimateSkill: {
      nameJa: form.ultimateName,
      damage: {
        power: form.ultimatePower,
        element: form.ultimateElement,
        targetType: form.ultimateTargetType,
        attackType: form.ultimateAttackType,
        flags: form.ultimateFlags,
      },
      lingering: {
        type: form.lingeringType,
        descJa: form.lingeringDescJa,
        duration: form.lingeringDuration,
      },
    },
  };
}

function initForm(data: Record<string, unknown> | null, key: string): DemonFormState {
  if (!data) {
    return {
      jobId: key,
      formName: '',
      tier: 1,
      concept: '',
      effectA: { descJa: '', statBoosts: [], flags: [] },
      effectB: { descJa: '', riskType: 'null', onAttackEffect: '' },
      ultimateName: '',
      ultimatePower: 3.0,
      ultimateElement: 'DARK',
      ultimateTargetType: 'SINGLE',
      ultimateAttackType: 'MAGIC',
      ultimateFlags: [],
      lingeringType: 'PARTY_BUFF',
      lingeringDescJa: '',
      lingeringDuration: 3,
    };
  }
  const raw = data as Record<string, unknown>;
  const ea = (raw.effectA as Record<string, unknown>) ?? {};
  const eb = (raw.effectB as Record<string, unknown>) ?? {};
  const ult = (raw.ultimateSkill as Record<string, unknown>) ?? {};
  const dmg = (ult.damage as Record<string, unknown>) ?? {};
  const ling = (ult.lingering as Record<string, unknown>) ?? {};
  const statBoostsRaw = (ea.statBoosts as Record<string, number>) ?? {};
  const statBoosts: StatBoostRow[] = Object.entries(statBoostsRaw).map(([k, v]) => ({ key: k, value: v }));
  return {
    jobId: (raw.jobId as string) ?? key,
    formName: (raw.formName as string) ?? '',
    tier: (raw.tier as number) ?? 1,
    concept: (raw.concept as string) ?? '',
    effectA: {
      descJa: (ea.descJa as string) ?? '',
      statBoosts,
      flags: (ea.flags as string[]) ?? [],
    },
    effectB: {
      descJa: (eb.descJa as string) ?? '',
      riskType: eb.riskType === null ? 'null' : ((eb.riskType as string) ?? 'null'),
      onAttackEffect: (eb.onAttackEffect as string) ?? '',
    },
    ultimateName: (ult.nameJa as string) ?? '',
    ultimatePower: (dmg.power as number) ?? 3.0,
    ultimateElement: (dmg.element as string) ?? 'DARK',
    ultimateTargetType: (dmg.targetType as string) ?? 'SINGLE',
    ultimateAttackType: (dmg.attackType as string) ?? 'MAGIC',
    ultimateFlags: (dmg.flags as string[]) ?? [],
    lingeringType: (ling.type as string) ?? 'PARTY_BUFF',
    lingeringDescJa: (ling.descJa as string) ?? '',
    lingeringDuration: (ling.duration as number) ?? 3,
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

export default function DemonFormEditor({ initialData, entryKey, isNew, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<DemonFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof DemonFormState>(key: K, val: DemonFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  function toggleFlag(which: 'effectA' | 'ultimateFlags', flag: string) {
    if (which === 'effectA') {
      const flags = form.effectA.flags.includes(flag)
        ? form.effectA.flags.filter((f) => f !== flag)
        : [...form.effectA.flags, flag];
      setForm((f) => ({ ...f, effectA: { ...f.effectA, flags } }));
    } else {
      const flags = form.ultimateFlags.includes(flag)
        ? form.ultimateFlags.filter((f) => f !== flag)
        : [...form.ultimateFlags, flag];
      updateField('ultimateFlags', flags);
    }
  }

  function updateStatBoost(idx: number, patch: Partial<StatBoostRow>) {
    setForm((f) => ({
      ...f,
      effectA: { ...f.effectA, statBoosts: f.effectA.statBoosts.map((s, i) => i === idx ? { ...s, ...patch } : s) },
    }));
  }

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const result = await saveEntry('demonForms', form.jobId || entryKey, formToJson(form));
    setSaving(false);
    if (result.success) router.push('/admin/demon-forms');
    else setError(result.error ?? '保存に失敗しました');
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('demonForms', entryKey);
    setSaving(false);
    if (result.success) router.push('/admin/demon-forms');
    else setError(result.error ?? '削除に失敗しました');
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/demon-forms"
        title={form.formName || (isNew ? '新規魔神化フォーム' : entryKey)}
        onSave={() => setShowSaveConfirm(true)}
        onCopy={handleCopy}
        onDelete={!isNew ? () => setShowDeleteConfirm(true) : undefined}
        saving={saving}
        isNew={isNew}
        entryKey={entryKey}
      />

      {isNew && (
        <AIDemonFormDraftPanel
          onApply={(draft) => {
            const draftKey = typeof draft.jobId === 'string' && draft.jobId ? draft.jobId : entryKey;
            setForm(initForm(draft, draftKey));
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

          {/* 基本情報 */}
          {activeTab === '基本情報' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="jobId（対応ジョブキー）">
                <input type="text" value={form.jobId} onChange={(e) => updateField('jobId', e.target.value)} disabled={!isNew} style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }} />
              </FormField>
              <FormField label="formName（フォーム名）">
                <input type="text" value={form.formName} onChange={(e) => updateField('formName', e.target.value)} style={inputStyle} />
              </FormField>
              <FormField label="tier">
                <select value={form.tier} onChange={(e) => updateField('tier', parseInt(e.target.value))} style={selectStyle}>
                  <option value={1}>Tier 1</option>
                  <option value={2}>Tier 2</option>
                </select>
              </FormField>
              <FormField label="concept（コンセプト文）">
                <textarea value={form.concept} onChange={(e) => updateField('concept', e.target.value)} style={textareaStyle} />
              </FormField>
            </div>
          )}

          {/* Effect A */}
          {activeTab === 'Effect A' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="descJa（説明文）">
                <textarea value={form.effectA.descJa} onChange={(e) => setForm((f) => ({ ...f, effectA: { ...f.effectA, descJa: e.target.value } }))} style={textareaStyle} />
              </FormField>

              <div>
                <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>statBoosts（ステータス強化）</p>
                {form.effectA.statBoosts.length === 0 ? (
                  <p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>なし</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 32px', gap: 6 }}>
                      {['stat', '倍率', ''].map((h) => <span key={h} style={{ color: '#7878a8', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>{h}</span>)}
                    </div>
                    {form.effectA.statBoosts.map((row, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 32px', gap: 6, alignItems: 'center' }}>
                        <select value={row.key} onChange={(e) => updateStatBoost(idx, { key: e.target.value })} style={selectStyle}>
                          <option value="">-- 選択 --</option>
                          {STAT_BOOST_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <input type="number" value={row.value} onChange={(e) => updateStatBoost(idx, { value: parseFloat(e.target.value) || 0 })} step={0.05} style={inputStyle} />
                        <button onClick={() => setForm((f) => ({ ...f, effectA: { ...f.effectA, statBoosts: f.effectA.statBoosts.filter((_, i) => i !== idx) } }))} style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setForm((f) => ({ ...f, effectA: { ...f.effectA, statBoosts: [...f.effectA.statBoosts, { key: 'atk', value: 0.5 }] } }))} style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>+ 追加</button>
              </div>

              <div>
                <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>flags</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_FLAGS.map((flag) => {
                    const checked = form.effectA.flags.includes(flag);
                    return (
                      <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleFlag('effectA', flag)} style={{ accentColor: '#8B00FF', width: 14, height: 14 }} />
                        <span style={{ color: checked ? '#d8b4fe' : '#7878a8', fontSize: 12, fontFamily: 'monospace' }}>{flag}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Effect B */}
          {activeTab === 'Effect B' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="descJa（説明文）">
                <textarea value={form.effectB.descJa} onChange={(e) => setForm((f) => ({ ...f, effectB: { ...f.effectB, descJa: e.target.value } }))} style={textareaStyle} />
              </FormField>
              <FormField label="riskType">
                <select value={form.effectB.riskType} onChange={(e) => setForm((f) => ({ ...f, effectB: { ...f.effectB, riskType: e.target.value } }))} style={selectStyle}>
                  {RISK_TYPES.map((r) => <option key={r} value={r}>{r === 'null' ? 'なし (null)' : r}</option>)}
                </select>
              </FormField>
              <FormField label="onAttackEffect">
                <input type="text" value={form.effectB.onAttackEffect} onChange={(e) => setForm((f) => ({ ...f, effectB: { ...f.effectB, onAttackEffect: e.target.value } }))} style={inputStyle} placeholder="SHIELD_REND, LIFE_DRAIN..." />
              </FormField>
            </div>
          )}

          {/* 奥義 */}
          {activeTab === '奥義' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="nameJa（奥義名）">
                <input type="text" value={form.ultimateName} onChange={(e) => updateField('ultimateName', e.target.value)} style={inputStyle} />
              </FormField>
              <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>damage</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingLeft: 12, borderLeft: '2px solid rgba(139,0,255,0.2)' }}>
                <FormField label="power"><input type="number" value={form.ultimatePower} onChange={(e) => updateField('ultimatePower', parseFloat(e.target.value) || 1)} step={0.1} style={inputStyle} /></FormField>
                <FormField label="element">
                  <select value={form.ultimateElement} onChange={(e) => updateField('ultimateElement', e.target.value)} style={selectStyle}>
                    {ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
                  </select>
                </FormField>
                <FormField label="targetType">
                  <select value={form.ultimateTargetType} onChange={(e) => updateField('ultimateTargetType', e.target.value)} style={selectStyle}>
                    {TARGET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="attackType">
                  <select value={form.ultimateAttackType} onChange={(e) => updateField('ultimateAttackType', e.target.value)} style={selectStyle}>
                    {ATTACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
              </div>
              <div>
                <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6 }}>flags</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ALL_FLAGS.map((flag) => {
                    const checked = form.ultimateFlags.includes(flag);
                    return (
                      <label key={flag} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleFlag('ultimateFlags', flag)} style={{ accentColor: '#8B00FF', width: 14, height: 14 }} />
                        <span style={{ color: checked ? '#d8b4fe' : '#7878a8', fontSize: 12, fontFamily: 'monospace' }}>{flag}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginTop: 4 }}>lingering</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, borderLeft: '2px solid rgba(139,0,255,0.2)' }}>
                <FormField label="type">
                  <select value={form.lingeringType} onChange={(e) => updateField('lingeringType', e.target.value)} style={selectStyle}>
                    {LINGERING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="descJa">
                  <textarea value={form.lingeringDescJa} onChange={(e) => updateField('lingeringDescJa', e.target.value)} style={{ ...textareaStyle, minHeight: 60 }} />
                </FormField>
                <FormField label="duration（行動数）">
                  <input type="number" value={form.lingeringDuration} onChange={(e) => updateField('lingeringDuration', parseInt(e.target.value) || 1)} min={1} style={inputStyle} />
                </FormField>
              </div>
            </div>
          )}

          {/* 依存関係 */}
          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog open={showSaveConfirm} title="保存の確認" message={`"${form.jobId || entryKey}" を保存します。`} onConfirm={handleConfirmedSave} onCancel={() => setShowSaveConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title="削除の確認" message={`"${entryKey}" を削除します。`} onConfirm={handleConfirmedDelete} onCancel={() => setShowDeleteConfirm(false)} danger />
    </div>
  );
}
