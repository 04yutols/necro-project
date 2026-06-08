'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntry, deleteEntry } from '@/app/admin/actions';
import skillsData from '@/data/master/skills.json';
import FormTabs from './shared/FormTabs';
import FormSaveBar from './shared/FormSaveBar';
import FormField from './shared/FormField';
import JsonSidebar from './shared/JsonSidebar';
import ConfirmDialog from './shared/ConfirmDialog';
import AIJobDraftPanel from '../AIJobDraftPanel';
import DependenciesTab from './shared/DependenciesTab';
import type { DependencyRef } from '@/app/admin/actions';
import type { BaseStats, JobBaseStatsByLevel, SkillData } from '@/types/game';
import {
  JOB_BASE_STAT_KEYS,
  clampJobBaseStatValue,
  interpolateJobBaseStatColumn,
  interpolateJobBaseStatsByFinalLevel,
  type JobBaseStatKey,
} from '@/logic/JobBaseStatsInterpolation';

const TABS = ['基本情報', '解放条件', 'ステータス補正', '基礎ステータス', 'エナジー', 'レベルボーナス', 'スキル配置', '依存関係'];
const CATEGORIES = ['PHYSICAL', 'MAGICAL', 'SUPPORT'];
const ATTACK_TYPES = ['SLASH', 'STRIKE', 'PROJECTILE', 'MAGIC', 'SUMMON', 'HEAL'];
const MASTER_SKILLS = skillsData as Record<string, SkillData>;

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

const STAT_FIELDS = JOB_BASE_STAT_KEYS;
const INTEGER_STAT_FIELDS = new Set<JobBaseStatKey>(['hp', 'atk', 'def', 'spd']);

type UnlockJob = { jobId: string; minLevel: number };
type SkillSlot = { level: number; skillId: string };
type StatKey = JobBaseStatKey;
type BaseStatsByLevel = JobBaseStatsByLevel;
type BaseStatDrafts = Record<string, string>;
type SkillOption = { id: string; name: string; label: string };

const SKILL_OPTIONS: SkillOption[] = Object.entries(MASTER_SKILLS)
  .map(([id, skill]) => ({
    id,
    name: skill.name || id,
    label: `${skill.name || id} / ${skill.element ?? 'NONE'} / ${skill.type} / MP${skill.mpCost ?? 0}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id));

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
  baseStatsByLevel: BaseStatsByLevel;
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
    baseStatsByLevel: form.baseStatsByLevel,
    energyCurve: {
      baseMaxEnergy: form.baseMaxEnergy,
      ultimateCost: form.ultimateCost,
      spGrowthPerLevel: form.spGrowthPerLevel,
    },
    levelBonuses,
    skills: form.skills,
  };
}

function buildDefaultBaseStatsByLevel(): BaseStatsByLevel {
  return Object.fromEntries(Array.from({ length: 100 }, (_, index) => {
    const level = index + 1;
    const x = level - 1;
    return [String(level), {
      hp: Math.round(30 + x * 1.2),
      atk: Math.round(4 + x * 0.1),
      def: Math.round(4 + x * 0.1),
      spd: 100,
      critRate: 5,
      critDmg: 150,
      effectHit: 0,
      effectRes: 0,
    } satisfies BaseStats];
  })) as BaseStatsByLevel;
}

function normalizeBaseStatsByLevel(value: unknown): BaseStatsByLevel {
  const defaults = buildDefaultBaseStatsByLevel();
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return defaults;
  const raw = value as Record<string, unknown>;

  return Object.fromEntries(Array.from({ length: 100 }, (_, index) => {
    const level = String(index + 1);
    const rawStats = raw[level];
    const source = typeof rawStats === 'object' && rawStats !== null && !Array.isArray(rawStats)
      ? rawStats as Record<string, unknown>
      : {};
    const normalizedStats = STAT_FIELDS.reduce((stats, key) => {
      const fallback = defaults[level][key];
      const parsed = typeof source[key] === 'number' ? source[key] : Number(source[key]);
      stats[key] = clampJobBaseStatValue(key, Number.isFinite(parsed) ? parsed : fallback);
      return stats;
    }, {} as BaseStats);
    return [level, normalizedStats];
  })) as BaseStatsByLevel;
}

function getBaseStatDraftKey(level: number, key: StatKey): string {
  return `${level}:${key}`;
}

function formatBaseStatInputValue(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function parseBaseStatInputValue(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSkillOptionsForValue(skillId: string): SkillOption[] {
  if (!skillId || MASTER_SKILLS[skillId]) return SKILL_OPTIONS;
  return [{ id: skillId, name: skillId, label: `未登録: ${skillId}` }, ...SKILL_OPTIONS];
}

function initForm(data: Record<string, unknown> | null): JobFormState {
  const defaultStats = Object.fromEntries(STAT_FIELDS.map((k) => [k, 1.0]));
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
      baseStatsByLevel: buildDefaultBaseStatsByLevel(),
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
    baseStatsByLevel: normalizeBaseStatsByLevel(raw.baseStatsByLevel),
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
  const [selectedBaseStatsLevel, setSelectedBaseStatsLevel] = useState(1);
  const [baseStatDrafts, setBaseStatDrafts] = useState<BaseStatDrafts>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof JobFormState>(key: K, val: JobFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  const updateBaseStat = useCallback((level: number, key: StatKey, value: number) => {
    const safeLevel = Math.min(100, Math.max(1, Math.floor(level)));
    const normalizedValue = clampJobBaseStatValue(key, value);
    setForm((current) => {
      const nextBaseStatsByLevel: BaseStatsByLevel = {
        ...current.baseStatsByLevel,
        [String(safeLevel)]: {
          ...current.baseStatsByLevel[String(safeLevel)],
          [key]: normalizedValue,
        },
      };

      return {
        ...current,
        baseStatsByLevel: safeLevel === 100
          ? interpolateJobBaseStatColumn(nextBaseStatsByLevel, key, normalizedValue)
          : nextBaseStatsByLevel,
      };
    });
  }, []);

  const updateBaseStatInput = useCallback((level: number, key: StatKey, value: string) => {
    const safeLevel = Math.min(100, Math.max(1, Math.floor(level)));
    const draftKey = getBaseStatDraftKey(safeLevel, key);
    setBaseStatDrafts((current) => ({ ...current, [draftKey]: value }));

    const parsed = parseBaseStatInputValue(value);
    if (parsed !== null) updateBaseStat(safeLevel, key, parsed);
  }, [updateBaseStat]);

  const commitBaseStatInput = useCallback((level: number, key: StatKey) => {
    const safeLevel = Math.min(100, Math.max(1, Math.floor(level)));
    const draftKey = getBaseStatDraftKey(safeLevel, key);
    const parsed = parseBaseStatInputValue(baseStatDrafts[draftKey] ?? '');
    if (parsed !== null) updateBaseStat(safeLevel, key, parsed);

    setBaseStatDrafts((current) => {
      const { [draftKey]: _finishedDraft, ...rest } = current;
      return rest;
    });
  }, [baseStatDrafts, updateBaseStat]);

  const interpolateAllBaseStats = useCallback(() => {
    setForm((current) => ({
      ...current,
      baseStatsByLevel: interpolateJobBaseStatsByFinalLevel(
        current.baseStatsByLevel,
        current.baseStatsByLevel['100'],
      ),
    }));
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

      {isNew && (
        <AIJobDraftPanel
          onApply={(draft) => {
            setForm(initForm(draft));
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
            </div>
          )}

          {/* 基礎ステータス */}
          {activeTab === '基礎ステータス' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FormField label="編集レベル">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={selectedBaseStatsLevel}
                      onChange={(e) => setSelectedBaseStatsLevel(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                      style={inputStyle}
                    />
                  </FormField>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[1, 10, 20, 50, 100].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSelectedBaseStatsLevel(level)}
                        style={{
                          height: 32,
                          borderRadius: 6,
                          border: selectedBaseStatsLevel === level ? '1px solid rgba(216,180,254,0.7)' : '1px solid rgba(139,0,255,0.22)',
                          background: selectedBaseStatsLevel === level ? 'rgba(139,0,255,0.24)' : 'rgba(12,8,24,0.72)',
                          color: '#d8b4fe',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Lv.{level}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={interpolateAllBaseStats}
                    style={{
                      height: 34,
                      borderRadius: 6,
                      border: '1px solid rgba(216,180,254,0.48)',
                      background: 'rgba(139,0,255,0.18)',
                      color: '#f5e8ff',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Lv100から補完
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px 12px' }}>
                  {STAT_FIELDS.map((key) => (
                    <FormField key={key} label={key}>
                      <input
                        type="text"
                        inputMode={INTEGER_STAT_FIELDS.has(key) ? 'numeric' : 'decimal'}
                        value={baseStatDrafts[getBaseStatDraftKey(selectedBaseStatsLevel, key)] ?? formatBaseStatInputValue(form.baseStatsByLevel[String(selectedBaseStatsLevel)]?.[key])}
                        onChange={(e) => updateBaseStatInput(selectedBaseStatsLevel, key, e.target.value)}
                        onBlur={() => commitBaseStatInput(selectedBaseStatsLevel, key)}
                        step={INTEGER_STAT_FIELDS.has(key) ? 1 : 0.1}
                        min={0}
                        style={inputStyle}
                      />
                    </FormField>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 460, border: '1px solid rgba(139,0,255,0.18)', borderRadius: 6 }}>
                <div style={{ minWidth: 920 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(8, minmax(86px, 1fr))', gap: 0, position: 'sticky', top: 0, background: '#101018', zIndex: 1, borderBottom: '1px solid rgba(139,0,255,0.22)' }}>
                    <span style={{ padding: '8px 10px', color: '#a78bfa', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>Lv</span>
                    {STAT_FIELDS.map((key) => <span key={key} style={{ padding: '8px 6px', color: '#a78bfa', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>{key}</span>)}
                  </div>
                  {Array.from({ length: 100 }, (_, index) => {
                    const level = index + 1;
                    const stats = form.baseStatsByLevel[String(level)];
                    return (
                      <div key={level} style={{ display: 'grid', gridTemplateColumns: '56px repeat(8, minmax(86px, 1fr))', gap: 0, borderBottom: '1px solid rgba(139,0,255,0.08)', background: selectedBaseStatsLevel === level ? 'rgba(139,0,255,0.12)' : 'transparent' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedBaseStatsLevel(level)}
                          style={{ border: 0, borderRight: '1px solid rgba(139,0,255,0.10)', background: 'transparent', color: '#d8b4fe', fontSize: 11, cursor: 'pointer' }}
                        >
                          {level}
                        </button>
                        {STAT_FIELDS.map((key) => (
                          <input
                            key={key}
                            type="text"
                            inputMode={INTEGER_STAT_FIELDS.has(key) ? 'numeric' : 'decimal'}
                            value={baseStatDrafts[getBaseStatDraftKey(level, key)] ?? formatBaseStatInputValue(stats?.[key])}
                            onChange={(e) => updateBaseStatInput(level, key, e.target.value)}
                            onBlur={() => commitBaseStatInput(level, key)}
                            step={INTEGER_STAT_FIELDS.has(key) ? 1 : 0.1}
                            min={0}
                            style={{
                              height: 34,
                              border: 0,
                              borderRight: '1px solid rgba(139,0,255,0.08)',
                              background: 'rgba(26,26,36,0.78)',
                              color: '#e0d0ff',
                              fontFamily: 'monospace',
                              fontSize: 12,
                              padding: '0 8px',
                              outline: 'none',
                              boxSizing: 'border-box',
                              width: '100%',
                            }}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
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
                {['level', 'skill', ''].map((h) => (
                  <span key={h} style={{ color: '#7878a8', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>{h}</span>
                ))}
              </div>
              {form.skills.map((s, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 32px', gap: 6, alignItems: 'center' }}>
                  <input type="number" value={s.level} onChange={(e) => updateField('skills', form.skills.map((sk, i) => i === idx ? { ...sk, level: parseInt(e.target.value) || 1 } : sk))} style={inputStyle} min={1} />
                  <select value={s.skillId} onChange={(e) => updateField('skills', form.skills.map((sk, i) => i === idx ? { ...sk, skillId: e.target.value } : sk))} style={selectStyle}>
                    <option value="">スキルを選択</option>
                    {getSkillOptionsForValue(s.skillId).map((skill) => (
                      <option key={skill.id} value={skill.id}>{skill.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => updateField('skills', form.skills.filter((_, i) => i !== idx))} style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => updateField('skills', [...form.skills, { level: 1, skillId: '' }])} style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}>+ 追加</button>
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
