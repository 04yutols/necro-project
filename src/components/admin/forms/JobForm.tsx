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

const TABS = ['基本情報', '解放条件', 'ステータス補正', 'エナジー', 'レベルボーナス', 'スキル配置', '依存関係'];
const CATEGORIES = ['PHYSICAL', 'MAGICAL', 'SUPPORT'];
const ATTACK_TYPES = ['SLASH', 'PIERCE', 'BLUNT', 'MAGIC'];

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

const STAT_FIELDS = ['hp', 'atk', 'def', 'spd', 'critRate', 'critDmg', 'effectHit', 'effectRes'];
const GROWTH_FIELDS = ['hp', 'atk', 'def'];

type UnlockJob = { jobId: string; minLevel: number };
type SkillSlot = { level: number; skillId: string };

type JobFormState = {
  name: string;
  displayName: string;
  nameEn: string;
  title: string;
  tier: number;
  category: string;
  baseAttackType: string;
  role: string;
  description: string;
  unlockJobs: UnlockJob[];
  statModifiers: Record<string, number>;
  growthModifiers: Record<string, number>;
  baseMaxEnergy: number;
  ultimateCost: number;
  spGrowthPerLevel: number;
  levelBonusesRaw: string;
  skills: SkillSlot[];
};

function formToJson(form: JobFormState): Record<string, unknown> {
  let levelBonuses: Record<string, unknown> = {};
  try {
    levelBonuses = JSON.parse(form.levelBonusesRaw) as Record<string, unknown>;
  } catch { /* leave empty */ }
  return {
    name: form.name,
    displayName: form.displayName,
    nameEn: form.nameEn,
    title: form.title,
    tier: form.tier,
    category: form.category,
    baseAttackType: form.baseAttackType,
    role: form.role,
    description: form.description,
    ...(form.tier === 2 && form.unlockJobs.length > 0
      ? { unlockRequires: { jobs: form.unlockJobs } }
      : {}),
    statModifiers: form.statModifiers,
    growthModifiers: form.growthModifiers,
    energyCurve: {
      baseMaxEnergy: form.baseMaxEnergy,
      ultimateCost: form.ultimateCost,
      spGrowthPerLevel: form.spGrowthPerLevel,
    },
    levelBonuses,
    skills: form.skills,
  };
}

function initForm(data: Record<string, unknown> | null): JobFormState {
  const defaultStats = Object.fromEntries(STAT_FIELDS.map((k) => [k, 1.0]));
  const defaultGrowth = Object.fromEntries(GROWTH_FIELDS.map((k) => [k, 1.0]));
  if (!data) {
    return {
      name: '',
      displayName: '',
      nameEn: '',
      title: '',
      tier: 1,
      category: 'PHYSICAL',
      baseAttackType: 'SLASH',
      role: '',
      description: '',
      unlockJobs: [],
      statModifiers: defaultStats,
      growthModifiers: defaultGrowth,
      baseMaxEnergy: 100,
      ultimateCost: 100,
      spGrowthPerLevel: 1,
      levelBonusesRaw: '{"10":{},"20":{},"30":{}}',
      skills: [],
    };
  }
  const raw = data as Record<string, unknown>;
  const energyCurve = (raw.energyCurve as Record<string, number>) ?? {};
  const unlockReq = (raw.unlockRequires as Record<string, unknown>) ?? {};
  const unlockJobs = (unlockReq.jobs as UnlockJob[]) ?? [];
  return {
    name: (raw.name as string) ?? '',
    displayName: (raw.displayName as string) ?? '',
    nameEn: (raw.nameEn as string) ?? '',
    title: (raw.title as string) ?? '',
    tier: (raw.tier as number) ?? 1,
    category: (raw.category as string) ?? 'PHYSICAL',
    baseAttackType: (raw.baseAttackType as string) ?? 'SLASH',
    role: (raw.role as string) ?? '',
    description: (raw.description as string) ?? '',
    unlockJobs,
    statModifiers: (raw.statModifiers as Record<string, number>) ?? defaultStats,
    growthModifiers: (raw.growthModifiers as Record<string, number>) ?? defaultGrowth,
    baseMaxEnergy: energyCurve.baseMaxEnergy ?? 100,
    ultimateCost: energyCurve.ultimateCost ?? 100,
    spGrowthPerLevel: energyCurve.spGrowthPerLevel ?? 1,
    levelBonusesRaw: JSON.stringify(raw.levelBonuses ?? { '10': {}, '20': {}, '30': {} }, null, 2),
    skills: (raw.skills as SkillSlot[]) ?? [],
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

export default function JobForm({ initialData, entryKey, isNew, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<JobFormState>(() => initForm(initialData));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof JobFormState>(key: K, val: JobFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const result = await saveEntry('jobs', entryKey, formToJson(form));
    setSaving(false);
    if (result.success) router.push('/admin/jobs');
    else setError(result.error ?? '保存に失敗しました');
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('jobs', entryKey);
    setSaving(false);
    if (result.success) router.push('/admin/jobs');
    else setError(result.error ?? '削除に失敗しました');
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/jobs"
        title={form.displayName || form.name || (isNew ? '新規ジョブ' : entryKey)}
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

          {/* 基本情報 */}
          {activeTab === '基本情報' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="name (キー名)"><input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="displayName (日本語)"><input type="text" value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="nameEn"><input type="text" value={form.nameEn} onChange={(e) => updateField('nameEn', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="title（肩書）"><input type="text" value={form.title} onChange={(e) => updateField('title', e.target.value)} style={inputStyle} /></FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="tier">
                  <select value={form.tier} onChange={(e) => updateField('tier', parseInt(e.target.value))} style={selectStyle}>
                    <option value={1}>Tier 1</option>
                    <option value={2}>Tier 2</option>
                  </select>
                </FormField>
                <FormField label="category">
                  <select value={form.category} onChange={(e) => updateField('category', e.target.value)} style={selectStyle}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
                <FormField label="baseAttackType">
                  <select value={form.baseAttackType} onChange={(e) => updateField('baseAttackType', e.target.value)} style={selectStyle}>
                    {ATTACK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="role"><input type="text" value={form.role} onChange={(e) => updateField('role', e.target.value)} style={inputStyle} /></FormField>
              <FormField label="description"><textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} style={textareaStyle} /></FormField>
            </div>
          )}

          {/* 解放条件 */}
          {activeTab === '解放条件' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {form.tier === 1 ? (
                <p style={{ color: '#7878a8', fontSize: 13 }}>Tier 1 ジョブは解放条件なし</p>
              ) : (
                <>
                  <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>解放に必要なジョブと最低レベル</p>
                  {form.unlockJobs.length === 0 ? (
                    <p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic' }}>なし</p>
                  ) : (
                    form.unlockJobs.map((uj, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 32px', gap: 8, alignItems: 'center' }}>
                        <input type="text" value={uj.jobId} onChange={(e) => updateField('unlockJobs', form.unlockJobs.map((j, i) => i === idx ? { ...j, jobId: e.target.value } : j))} style={inputStyle} placeholder="warrior" />
                        <input type="number" value={uj.minLevel} onChange={(e) => updateField('unlockJobs', form.unlockJobs.map((j, i) => i === idx ? { ...j, minLevel: parseInt(e.target.value) || 1 } : j))} style={inputStyle} />
                        <button onClick={() => updateField('unlockJobs', form.unlockJobs.filter((_, i) => i !== idx))} style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))
                  )}
                  <button onClick={() => updateField('unlockJobs', [...form.unlockJobs, { jobId: '', minLevel: 20 }])} style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>+ 追加</button>
                </>
              )}
            </div>
          )}

          {/* ステータス補正 */}
          {activeTab === 'ステータス補正' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>statModifiers（倍率：1.0 = 等倍）</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {STAT_FIELDS.map((key) => (
                  <FormField key={key} label={key}>
                    <input
                      type="number"
                      value={form.statModifiers[key] ?? 1.0}
                      onChange={(e) => updateField('statModifiers', { ...form.statModifiers, [key]: parseFloat(e.target.value) || 1.0 })}
                      min={0.5} max={1.5} step={0.01}
                      style={inputStyle}
                    />
                  </FormField>
                ))}
              </div>
              <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginTop: 8 }}>growthModifiers（成長補正）</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 16px' }}>
                {GROWTH_FIELDS.map((key) => (
                  <FormField key={key} label={key}>
                    <input
                      type="number"
                      value={form.growthModifiers[key] ?? 1.0}
                      onChange={(e) => updateField('growthModifiers', { ...form.growthModifiers, [key]: parseFloat(e.target.value) || 1.0 })}
                      step={0.01}
                      style={inputStyle}
                    />
                  </FormField>
                ))}
              </div>
            </div>
          )}

          {/* エナジー */}
          {activeTab === 'エナジー' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <FormField label="baseMaxEnergy"><input type="number" value={form.baseMaxEnergy} onChange={(e) => updateField('baseMaxEnergy', parseInt(e.target.value) || 100)} style={inputStyle} /></FormField>
              <FormField label="ultimateCost"><input type="number" value={form.ultimateCost} onChange={(e) => updateField('ultimateCost', parseInt(e.target.value) || 100)} style={inputStyle} /></FormField>
              <FormField label="spGrowthPerLevel"><input type="number" value={form.spGrowthPerLevel} onChange={(e) => updateField('spGrowthPerLevel', parseInt(e.target.value) || 1)} style={inputStyle} /></FormField>
            </div>
          )}

          {/* レベルボーナス */}
          {activeTab === 'レベルボーナス' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>levelBonuses（JSON）</p>
              <textarea
                value={form.levelBonusesRaw}
                onChange={(e) => updateField('levelBonusesRaw', e.target.value)}
                style={{ ...textareaStyle, minHeight: 160, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          )}

          {/* スキル配置 */}
          {/* 依存関係 */}
          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}

          {activeTab === 'スキル配置' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 32px', gap: 6, marginBottom: 4 }}>
                {['level', 'skillId', ''].map((h) => (
                  <span key={h} style={{ color: '#7878a8', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>{h}</span>
                ))}
              </div>
              {form.skills.map((s, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 32px', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={s.level} onChange={(e) => updateField('skills', form.skills.map((sk, i) => i === idx ? { ...sk, level: parseInt(e.target.value) || 1 } : sk))} style={inputStyle} min={1} />
                  <input type="text" value={s.skillId} onChange={(e) => updateField('skills', form.skills.map((sk, i) => i === idx ? { ...sk, skillId: e.target.value } : sk))} style={inputStyle} placeholder="skill_warrior_1" />
                  <button onClick={() => updateField('skills', form.skills.filter((_, i) => i !== idx))} style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              <button onClick={() => updateField('skills', [...form.skills, { level: 1, skillId: '' }])} style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>+ 追加</button>
            </div>
          )}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog open={showSaveConfirm} title="保存の確認" message={`"${entryKey}" を保存します。`} onConfirm={handleConfirmedSave} onCancel={() => setShowSaveConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title="削除の確認" message={`"${entryKey}" を削除します。`} onConfirm={handleConfirmedDelete} onCancel={() => setShowDeleteConfirm(false)} danger />
    </div>
  );
}
