'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntry, deleteEntry } from '@/app/admin/actions';
import skillsData from '@/data/master/skills.json';
import FormTabs from './shared/FormTabs';
import FormSaveBar from './shared/FormSaveBar';
import FormField from './shared/FormField';
import StatInputGrid from './shared/StatInputGrid';
import ResistanceGrid from './shared/ResistanceGrid';
import DropTableEditor, { DropEntry } from './shared/DropTableEditor';
import { gimmickValueToInput, gimmickRowsToJson } from './shared/gimmickValue';
import JsonSidebar from './shared/JsonSidebar';
import ConfirmDialog from './shared/ConfirmDialog';
import DependenciesTab from './shared/DependenciesTab';
import AIEnemyDraftPanel from '../AIEnemyDraftPanel';
import type { DependencyRef } from '@/app/admin/actions';
import type { SkillData } from '@/types/game';

const TABS = ['基本情報', 'ステータス', '属性耐性', 'ネクロマンス', 'ギミック', 'ドロップ', 'バトル', '依存関係'];
const TIERS = ['MINION', 'ELITE', 'BOSS'];
const TRIBES = ['UNDEAD', 'DEMON', 'BEAST', 'HUMANOID', 'DRAGON', 'ORC'];
const SPRITES = ['WRAITH', 'GIANT', 'WYRM'];
const ELEMENTS = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'];
const MASTER_SKILLS = skillsData as Record<string, SkillData>;
const NECROMANCE_RATE_BY_TIER: Record<string, number> = { MINION: 0.12, ELITE: 0.04, BOSS: 0.001 };
const NECROMANCE_COST_BY_TIER: Record<string, number> = { MINION: 1, ELITE: 2, BOSS: 4 };

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

type GimmickRow = { trigger: string; effect: string; value: string };
type SkillOption = { id: string; name: string; label: string };
type NecromanceFormState = {
  captureRatePercent: number;
  allyCost: number;
  allyStats: Record<string, number>;
  skillIds: string[];
};

const SKILL_OPTIONS: SkillOption[] = Object.entries(MASTER_SKILLS)
  .map(([id, skill]) => ({
    id,
    name: skill.name || id,
    label: `${skill.name || id} / ${skill.element ?? 'NONE'} / ${skill.type} / MP${skill.mpCost ?? 0}`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id));

type EnemyFormState = {
  id: string;
  name: string;
  nameJa: string;
  nameEn: string;
  tier: string;
  tribe: string;
  description: string;
  stats: Record<string, number>;
  resistances: Record<string, number>;
  shieldHp: number;
  maxShieldHp: number;
  gimmicks: GimmickRow[];
  necromance: NecromanceFormState;
  dropTable: DropEntry[];
  battle: { color: string; sprite: string; size: number };
};

function clampRatePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function rateToPercent(rate: unknown, tier: string): number {
  const fallback = (NECROMANCE_RATE_BY_TIER[tier] ?? 0.12) * 100;
  return clampRatePercent(typeof rate === 'number' && Number.isFinite(rate) ? rate * 100 : fallback);
}

function getSkillOptionsForValue(skillId: string): SkillOption[] {
  if (!skillId || MASTER_SKILLS[skillId]) return SKILL_OPTIONS;
  return [{ id: skillId, name: skillId, label: `未登録: ${skillId}` }, ...SKILL_OPTIONS];
}

function normalizeSkillIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

function necromanceToJson(necromance: NecromanceFormState): Record<string, unknown> {
  return {
    captureRate: Number((clampRatePercent(necromance.captureRatePercent) / 100).toFixed(6)),
    allyCost: Math.max(1, Math.floor(necromance.allyCost || 1)),
    allyStats: necromance.allyStats,
    skillIds: necromance.skillIds.filter(Boolean),
  };
}

function formToJson(form: EnemyFormState): Record<string, unknown> {
  const weaknesses = ELEMENTS.filter((el) => (form.resistances[el] ?? 0) < 0);
  const resistancesCleaned: Record<string, number> = {};
  for (const el of ELEMENTS) {
    if ((form.resistances[el] ?? 0) !== 0) {
      resistancesCleaned[el] = form.resistances[el];
    }
  }
  return {
    id: form.id,
    name: form.name,
    nameJa: form.nameJa,
    nameEn: form.nameEn,
    tier: form.tier,
    tribe: form.tribe,
    stats: form.stats,
    resistances: resistancesCleaned,
    weaknesses,
    ...(form.shieldHp > 0 || form.maxShieldHp > 0
      ? { shieldHp: form.shieldHp, maxShieldHp: form.maxShieldHp }
      : {}),
    ...(form.gimmicks.length > 0
      ? { gimmicks: gimmickRowsToJson(form.gimmicks) }
      : {}),
    necromance: necromanceToJson(form.necromance),
    dropTable: form.dropTable,
    battle: form.battle,
    description: form.description,
  };
}

function initForm(data: Record<string, unknown> | null, key: string): EnemyFormState {
  if (!data) {
    return {
      id: key,
      name: '',
      nameJa: '',
      nameEn: '',
      tier: 'MINION',
      tribe: 'UNDEAD',
      description: '',
      stats: { hp: 10, atk: 4, def: 2, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
      resistances: {},
      shieldHp: 0,
      maxShieldHp: 0,
      gimmicks: [],
      necromance: {
        captureRatePercent: NECROMANCE_RATE_BY_TIER.MINION * 100,
        allyCost: NECROMANCE_COST_BY_TIER.MINION,
        allyStats: { hp: 10, atk: 4, def: 2, spd: 70, critRate: 0, critDmg: 150, effectHit: 0, effectRes: 0 },
        skillIds: [],
      },
      dropTable: [],
      battle: { color: '#9ca3af', sprite: 'WRAITH', size: 0.72 },
    };
  }
  const raw = data as Record<string, unknown>;
  const stats = (raw.stats as Record<string, number>) ?? {};
  const resistances = (raw.resistances as Record<string, number>) ?? {};
  const battle = (raw.battle as Record<string, unknown>) ?? {};
  const gimmicks: GimmickRow[] = Array.isArray(raw.gimmicks)
    ? (raw.gimmicks as Record<string, unknown>[]).map((g) => ({
        trigger: typeof g.trigger === 'string' ? g.trigger : '',
        effect: typeof g.effect === 'string' ? g.effect : '',
        value: gimmickValueToInput(g.value),
      }))
    : [];
  const dropTable = (raw.dropTable as DropEntry[]) ?? [];
  const tier = (raw.tier as string) ?? 'MINION';
  const necromance = (raw.necromance as Record<string, unknown>) ?? {};
  return {
    id: (raw.id as string) ?? key,
    name: (raw.name as string) ?? '',
    nameJa: (raw.nameJa as string) ?? '',
    nameEn: (raw.nameEn as string) ?? '',
    tier,
    tribe: (raw.tribe as string) ?? 'UNDEAD',
    description: (raw.description as string) ?? '',
    stats,
    resistances,
    shieldHp: (raw.shieldHp as number) ?? 0,
    maxShieldHp: (raw.maxShieldHp as number) ?? 0,
    gimmicks,
    necromance: {
      captureRatePercent: rateToPercent(necromance.captureRate, tier),
      allyCost: (necromance.allyCost as number) ?? NECROMANCE_COST_BY_TIER[tier] ?? 1,
      allyStats: (necromance.allyStats as Record<string, number>) ?? stats,
      skillIds: normalizeSkillIds(necromance.skillIds),
    },
    dropTable,
    battle: {
      color: (battle.color as string) ?? '#9ca3af',
      sprite: (battle.sprite as string) ?? 'WRAITH',
      size: (battle.size as number) ?? 0.72,
    },
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  itemIds: string[];
  materialIds: string[];
  dependencies?: DependencyRef[];
};

export default function EnemyForm({ initialData, entryKey, isNew, itemIds, materialIds, dependencies = [] }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<EnemyFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateField = useCallback(<K extends keyof EnemyFormState>(key: K, val: EnemyFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  const updateStat = useCallback((key: string, val: number) => {
    setForm((f) => ({ ...f, stats: { ...f.stats, [key]: val } }));
  }, []);

  const updateResistance = useCallback((el: string, val: number) => {
    setForm((f) => ({ ...f, resistances: { ...f.resistances, [el]: val } }));
  }, []);

  const updateGimmick = useCallback((idx: number, patch: Partial<GimmickRow>) => {
    setForm((f) => ({
      ...f,
      gimmicks: f.gimmicks.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }));
  }, []);

  const updateNecromance = useCallback((patch: Partial<NecromanceFormState>) => {
    setForm((f) => ({ ...f, necromance: { ...f.necromance, ...patch } }));
  }, []);

  const updateNecromanceStat = useCallback((key: string, val: number) => {
    setForm((f) => ({
      ...f,
      necromance: {
        ...f.necromance,
        allyStats: { ...f.necromance.allyStats, [key]: val },
      },
    }));
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const result = await saveEntry('enemies', form.id || entryKey, formToJson(form));
    setSaving(false);
    if (result.success) {
      router.push('/admin/enemies');
    } else {
      setError(result.error ?? '保存に失敗しました');
    }
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('enemies', entryKey);
    setSaving(false);
    if (result.success) {
      router.push('/admin/enemies');
    } else {
      setError(result.error ?? '削除に失敗しました');
    }
  }

  const weaknesses = ELEMENTS.filter((el) => (form.resistances[el] ?? 0) < 0);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/enemies"
        title={form.nameJa || form.name || (isNew ? '新規エネミー' : entryKey)}
        onSave={() => setShowSaveConfirm(true)}
        onCopy={handleCopy}
        onDelete={!isNew ? () => setShowDeleteConfirm(true) : undefined}
        saving={saving}
        isNew={isNew}
        entryKey={entryKey}
      />

      {isNew && (
        <AIEnemyDraftPanel
          onApply={(draft) => {
            const draftId = typeof draft.id === 'string' && draft.id ? draft.id : entryKey;
            setForm(initForm(draft, draftId));
            setActiveTab(TABS[0]);
            setError(null);
          }}
        />
      )}

      {error && (
        <div
          style={{
            background: 'rgba(127,29,29,0.3)',
            border: '1px solid rgba(220,38,38,0.4)',
            borderRadius: 6,
            padding: '10px 14px',
            color: '#fca5a5',
            fontSize: 14,
            marginBottom: 16,
          }}
        >
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
                <input
                  type="text"
                  value={form.id}
                  onChange={(e) => updateField('id', e.target.value)}
                  disabled={!isNew}
                  style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }}
                />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="name (英語キー)">
                  <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} />
                </FormField>
                <FormField label="nameJa (日本語名)">
                  <input type="text" value={form.nameJa} onChange={(e) => updateField('nameJa', e.target.value)} style={inputStyle} />
                </FormField>
                <FormField label="nameEn (表示用英語)">
                  <input type="text" value={form.nameEn} onChange={(e) => updateField('nameEn', e.target.value)} style={inputStyle} />
                </FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Tier">
                  <select value={form.tier} onChange={(e) => updateField('tier', e.target.value)} style={selectStyle}>
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="Tribe（種族）">
                  <select value={form.tribe} onChange={(e) => updateField('tribe', e.target.value)} style={selectStyle}>
                    {TRIBES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="description">
                <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} style={textareaStyle} />
              </FormField>
            </div>
          )}

          {/* ステータス */}
          {activeTab === 'ステータス' && (
            <StatInputGrid value={form.stats} onChange={updateStat} />
          )}

          {/* 属性耐性 */}
          {activeTab === '属性耐性' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ResistanceGrid value={form.resistances} onChange={updateResistance} />
              {weaknesses.length > 0 && (
                <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(127,29,29,0.15)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)' }}>
                  <span style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>弱点（自動抽出）: </span>
                  <span style={{ color: '#fca5a5', fontSize: 12, fontFamily: 'monospace' }}>{weaknesses.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* ネクロマンス */}
          {activeTab === 'ネクロマンス' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="獲得確率 %">
                  <input
                    type="number"
                    value={form.necromance.captureRatePercent}
                    onChange={(e) => updateNecromance({ captureRatePercent: clampRatePercent(parseFloat(e.target.value) || 0) })}
                    min={0}
                    max={100}
                    step={0.001}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="味方化後 cost">
                  <input
                    type="number"
                    value={form.necromance.allyCost}
                    onChange={(e) => updateNecromance({ allyCost: parseInt(e.target.value) || 1 })}
                    min={1}
                    max={9}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <div>
                <p style={{ color: '#7878a8', fontSize: 11, marginBottom: 10, fontFamily: 'Space Grotesk, sans-serif' }}>味方化後ステータス</p>
                <StatInputGrid value={form.necromance.allyStats} onChange={updateNecromanceStat} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif' }}>味方化後スキル</p>
                {form.necromance.skillIds.length === 0 ? (
                  <p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic' }}>スキルなし</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {form.necromance.skillIds.map((skillId, idx) => (
                      <div key={`${skillId}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr 32px', gap: 6, alignItems: 'center' }}>
                        <select
                          value={skillId}
                          onChange={(e) => updateNecromance({
                            skillIds: form.necromance.skillIds.map((id, i) => (i === idx ? e.target.value : id)),
                          })}
                          style={selectStyle}
                        >
                          <option value="">スキルを選択</option>
                          {getSkillOptionsForValue(skillId).map((skill) => (
                            <option key={skill.id} value={skill.id}>{skill.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => updateNecromance({ skillIds: form.necromance.skillIds.filter((_, i) => i !== idx) })}
                          style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => updateNecromance({ skillIds: [...form.necromance.skillIds, ''] })}
                  style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, alignSelf: 'flex-start' }}
                >
                  + スキルを追加
                </button>
              </div>
            </div>
          )}

          {/* ギミック */}
          {activeTab === 'ギミック' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="shieldHp">
                  <input type="number" value={form.shieldHp} onChange={(e) => updateField('shieldHp', parseInt(e.target.value) || 0)} style={inputStyle} />
                </FormField>
                <FormField label="maxShieldHp">
                  <input type="number" value={form.maxShieldHp} onChange={(e) => updateField('maxShieldHp', parseInt(e.target.value) || 0)} style={inputStyle} />
                </FormField>
              </div>
              <div>
                <p style={{ color: '#7878a8', fontSize: 11, marginBottom: 8, fontFamily: 'Space Grotesk, sans-serif' }}>ギミックテーブル</p>
                {form.gimmicks.length === 0 ? (
                  <p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic', marginBottom: 10 }}>ギミックなし</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 32px', gap: 6 }}>
                      {['trigger', 'effect', 'value', ''].map((h) => (
                        <span key={h} style={{ color: '#7878a8', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>{h}</span>
                      ))}
                    </div>
                    {form.gimmicks.map((g, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 32px', gap: 6, alignItems: 'center' }}>
                        <input type="text" value={g.trigger} onChange={(e) => updateGimmick(idx, { trigger: e.target.value })} style={inputStyle} placeholder="ON_SHIELD_BREAK" />
                        <input type="text" value={g.effect} onChange={(e) => updateGimmick(idx, { effect: e.target.value })} style={inputStyle} placeholder="SUMMON" />
                        <input type="text" value={g.value} onChange={(e) => updateGimmick(idx, { value: e.target.value })} style={inputStyle} placeholder="1（数値）" />
                        <button
                          onClick={() => updateField('gimmicks', form.gimmicks.filter((_, i) => i !== idx))}
                          style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 12, width: 28, height: 28 }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => updateField('gimmicks', [...form.gimmicks, { trigger: '', effect: '', value: '' }])}
                  style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                >
                  + 行を追加
                </button>
              </div>
            </div>
          )}

          {/* ドロップ */}
          {activeTab === 'ドロップ' && (
            <DropTableEditor
              value={form.dropTable}
              onChange={(entries) => updateField('dropTable', entries)}
              itemIds={itemIds}
              materialIds={materialIds}
            />
          )}

          {/* 依存関係 */}
          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}

          {/* バトル表示 */}
          {activeTab === 'バトル' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="battle.color">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="color"
                    value={form.battle.color}
                    onChange={(e) => updateField('battle', { ...form.battle, color: e.target.value })}
                    style={{ width: 48, height: 36, borderRadius: 4, cursor: 'pointer', border: '1px solid rgba(139,0,255,0.2)', background: 'transparent', padding: 2 }}
                  />
                  <input
                    type="text"
                    value={form.battle.color}
                    onChange={(e) => updateField('battle', { ...form.battle, color: e.target.value })}
                    style={{ ...inputStyle, width: 120 }}
                  />
                </div>
              </FormField>
              <FormField label="battle.sprite">
                <select value={form.battle.sprite} onChange={(e) => updateField('battle', { ...form.battle, sprite: e.target.value })} style={selectStyle}>
                  {SPRITES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
              <FormField label="battle.size (0.5 〜 1.5)">
                <input
                  type="number"
                  value={form.battle.size}
                  onChange={(e) => updateField('battle', { ...form.battle, size: parseFloat(e.target.value) || 0.72 })}
                  min={0.5}
                  max={1.5}
                  step={0.01}
                  style={inputStyle}
                />
              </FormField>
            </div>
          )}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog
        open={showSaveConfirm}
        title="保存の確認"
        message={`"${form.id || entryKey}" を保存します。マスターデータファイルが上書きされます。`}
        onConfirm={handleConfirmedSave}
        onCancel={() => setShowSaveConfirm(false)}
      />
      <ConfirmDialog
        open={showDeleteConfirm}
        title="削除の確認"
        message={`"${entryKey}" を削除します。この操作は取り消せません。`}
        onConfirm={handleConfirmedDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        danger
      />
    </div>
  );
}
