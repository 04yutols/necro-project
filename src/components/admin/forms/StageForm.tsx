'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntry, deleteEntry } from '@/app/admin/actions';
import {
  applyStageAreaSelection,
  buildStageAreaOptions,
  getStageAreaMasterId,
  resolveStageArea,
} from '@/logic/StageAreaLinkSystem';
import FormTabs from './shared/FormTabs';
import FormSaveBar from './shared/FormSaveBar';
import FormField from './shared/FormField';
import DropTableEditor, { DropEntry } from './shared/DropTableEditor';
import JsonSidebar from './shared/JsonSidebar';
import ConfirmDialog from './shared/ConfirmDialog';
import DependenciesTab from './shared/DependenciesTab';
import type { DependencyRef } from '@/app/admin/actions';

const TABS = ['基本情報', 'WAVE設定', '報酬', '依存関係'];
const NODE_TYPES = ['SAFE', 'DUNGEON', 'BOSS'];
const ELEMENTS = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'];
const AREA_GIMMICKS = ['NONE', 'SLIP_DAMAGE', 'STATUS_AILMENT'];
const WAVE_ROLES = ['WARMUP', 'SHIELD', 'ELITE', 'BOSS', 'MINIBOSS'];

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

type EnemyMeta = { id: string; nameJa: string; tier: string; tribe: string };
type WaveRow = { label: string; role: string; enemyIds: string[]; intent: string };

type StageFormState = {
  id: string;
  name: string;
  nameJa: string;
  nameEn: string;
  chapter: number;
  area: number;
  nodeType: string;
  element: string;
  difficulty: number;
  areaGimmick: string;
  unlockRequires: string;
  positionX: number;
  positionY: number;
  description: string;
  waves: WaveRow[];
  baseExp: number;
  baseGold: number;
  dropTable: DropEntry[];
};

function formToJson(form: StageFormState): Record<string, unknown> {
  const wavesData = form.nodeType === 'SAFE' ? [] : form.waves.map((w, i) => ({
    label: w.label || `WAVE ${i + 1}`,
    role: w.role,
    enemyIds: w.enemyIds,
    intent: w.intent,
  }));
  return {
    id: form.id,
    name: form.name,
    nameJa: form.nameJa,
    nameEn: form.nameEn,
    chapter: form.chapter,
    area: form.area,
    nodeType: form.nodeType,
    element: form.element,
    difficulty: form.difficulty,
    description: form.description,
    waveCount: wavesData.length,
    areaGimmick: form.areaGimmick,
    unlockRequires: form.unlockRequires.split(',').map((s) => s.trim()).filter(Boolean),
    waves: wavesData,
    rewards: {
      baseExp: form.baseExp,
      baseGold: form.baseGold,
      dropTable: form.dropTable,
    },
    position: { x: form.positionX, y: form.positionY },
  };
}

function initForm(data: Record<string, unknown> | null, key: string): StageFormState {
  if (!data) {
    return {
      id: key,
      name: '',
      nameJa: '',
      nameEn: '',
      chapter: 1,
      area: 1,
      nodeType: 'DUNGEON',
      element: 'NONE',
      difficulty: 1,
      areaGimmick: 'NONE',
      unlockRequires: '',
      positionX: 200,
      positionY: 400,
      description: '',
      waves: [{ label: 'WAVE 1', role: 'WARMUP', enemyIds: [], intent: '' }],
      baseExp: 10,
      baseGold: 500,
      dropTable: [],
    };
  }
  const raw = data as Record<string, unknown>;
  const rewards = (raw.rewards as Record<string, unknown>) ?? {};
  const position = (raw.position as Record<string, number>) ?? {};
  const waves = ((raw.waves as Record<string, unknown>[]) ?? []).map((w) => ({
    label: (w.label as string) ?? '',
    role: (w.role as string) ?? 'WARMUP',
    enemyIds: (w.enemyIds as string[]) ?? [],
    intent: (w.intent as string) ?? '',
  }));
  return {
    id: (raw.id as string) ?? key,
    name: (raw.name as string) ?? '',
    nameJa: (raw.nameJa as string) ?? '',
    nameEn: (raw.nameEn as string) ?? '',
    chapter: (raw.chapter as number) ?? 1,
    area: (raw.area as number) ?? 1,
    nodeType: (raw.nodeType as string) ?? 'DUNGEON',
    element: (raw.element as string) ?? 'NONE',
    difficulty: (raw.difficulty as number) ?? 1,
    areaGimmick: (raw.areaGimmick as string) ?? 'NONE',
    unlockRequires: ((raw.unlockRequires as string[]) ?? []).join(', '),
    positionX: position.x ?? 200,
    positionY: position.y ?? 400,
    description: (raw.description as string) ?? '',
    waves,
    baseExp: (rewards.baseExp as number) ?? 0,
    baseGold: (rewards.baseGold as number) ?? 0,
    dropTable: (rewards.dropTable as DropEntry[]) ?? [],
  };
}

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  itemIds: string[];
  materialIds: string[];
  enemyData?: EnemyMeta[];
  dependencies?: DependencyRef[];
  areas?: Record<string, Record<string, unknown>>;
};

export default function StageForm({ initialData, entryKey, isNew, itemIds, materialIds, enemyData = [], dependencies = [], areas = {} }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [form, setForm] = useState<StageFormState>(() => initForm(initialData, entryKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const areaOptions = useMemo(() => buildStageAreaOptions(areas), [areas]);
  const selectedArea = useMemo(() => resolveStageArea(form, areaOptions), [form, areaOptions]);
  const selectedAreaId = selectedArea?.id ?? getStageAreaMasterId(form);

  const updateField = useCallback(<K extends keyof StageFormState>(key: K, val: StageFormState[K]) => {
    setForm((f) => ({ ...f, [key]: val }));
  }, []);

  const updateWave = useCallback((idx: number, patch: Partial<WaveRow>) => {
    setForm((f) => ({ ...f, waves: f.waves.map((w, i) => (i === idx ? { ...w, ...patch } : w)) }));
  }, []);

  const handleAreaSelect = useCallback((areaId: string) => {
    const nextArea = areaOptions.find(option => option.id === areaId);
    if (!nextArea) return;
    setForm((f) => applyStageAreaSelection(f, nextArea));
  }, [areaOptions]);

  function handleCopy() {
    navigator.clipboard.writeText(JSON.stringify(formToJson(form), null, 2));
  }

  async function handleConfirmedSave() {
    setSaving(true);
    setShowSaveConfirm(false);
    const result = await saveEntry('stages', form.id || entryKey, formToJson(form));
    setSaving(false);
    if (result.success) {
      router.push('/admin/stages');
    } else {
      setError(result.error ?? '保存に失敗しました');
    }
  }

  async function handleConfirmedDelete() {
    setSaving(true);
    setShowDeleteConfirm(false);
    const result = await deleteEntry('stages', entryKey);
    setSaving(false);
    if (result.success) {
      router.push('/admin/stages');
    } else {
      setError(result.error ?? '削除に失敗しました');
    }
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
      <FormSaveBar
        backHref="/admin/stages"
        title={form.nameJa || form.name || (isNew ? '新規ステージ' : entryKey)}
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
              <FormField label="ID（キー）">
                <input type="text" value={form.id} onChange={(e) => updateField('id', e.target.value)} disabled={!isNew} style={{ ...inputStyle, opacity: isNew ? 1 : 0.5 }} />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="name"><input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="nameJa"><input type="text" value={form.nameJa} onChange={(e) => updateField('nameJa', e.target.value)} style={inputStyle} /></FormField>
                <FormField label="nameEn"><input type="text" value={form.nameEn} onChange={(e) => updateField('nameEn', e.target.value)} style={inputStyle} /></FormField>
              </div>
              <FormField label="紐づけエリア">
                <select value={selectedAreaId} onChange={(e) => handleAreaSelect(e.target.value)} style={selectStyle}>
                  {!selectedArea && (
                    <option value={selectedAreaId}>
                      未登録: CH{form.chapter}-AREA{form.area} ({selectedAreaId})
                    </option>
                  )}
                  {areaOptions.map((area) => (
                    <option key={area.id} value={area.id}>
                      CH{area.chapter}-AREA{area.area} / {area.nameJa} ({area.id})
                    </option>
                  ))}
                </select>
              </FormField>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 6, background: selectedArea ? 'rgba(139,0,255,0.06)' : 'rgba(127,29,29,0.18)', border: `1px solid ${selectedArea ? 'rgba(139,0,255,0.16)' : 'rgba(220,38,38,0.28)'}` }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, marginTop: 4, flexShrink: 0, background: selectedArea?.color ?? '#ef4444', boxShadow: `0 0 12px ${selectedArea?.color ?? '#ef4444'}` }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, color: selectedArea ? '#d8b4fe' : '#fca5a5', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
                    {selectedArea ? `${selectedArea.nameJa} / ${selectedArea.nameEn || selectedArea.id}` : `未登録エリア: CH${form.chapter}-AREA${form.area}`}
                  </p>
                  <p style={{ margin: '3px 0 0', color: '#7878a8', fontSize: 11, lineHeight: 1.5 }}>
                    {selectedArea ? `${selectedArea.description || '説明未設定'} · ${selectedArea.id}` : 'areas.json に該当エリアがありません。選択式のエリアから紐づけ直してください。'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="chapter（選択で自動入力）"><input type="number" value={form.chapter} onChange={(e) => updateField('chapter', parseInt(e.target.value) || 1)} style={inputStyle} /></FormField>
                <FormField label="area（選択で自動入力）"><input type="number" value={form.area} onChange={(e) => updateField('area', parseInt(e.target.value) || 1)} style={inputStyle} /></FormField>
                <FormField label="difficulty (0-5)"><input type="number" value={form.difficulty} onChange={(e) => updateField('difficulty', parseInt(e.target.value) || 0)} min={0} max={5} style={inputStyle} /></FormField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="nodeType">
                  <select value={form.nodeType} onChange={(e) => updateField('nodeType', e.target.value)} style={selectStyle}>
                    {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label="element">
                  <select value={form.element} onChange={(e) => updateField('element', e.target.value)} style={selectStyle}>
                    {ELEMENTS.map((el) => <option key={el} value={el}>{el}</option>)}
                  </select>
                </FormField>
                <FormField label="areaGimmick">
                  <select value={form.areaGimmick} onChange={(e) => updateField('areaGimmick', e.target.value)} style={selectStyle}>
                    {AREA_GIMMICKS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </FormField>
              </div>
              <FormField label="unlockRequires（カンマ区切り）">
                <input type="text" value={form.unlockRequires} onChange={(e) => updateField('unlockRequires', e.target.value)} style={inputStyle} placeholder="area1_node1, area1_node2" />
              </FormField>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="position.x"><input type="number" value={form.positionX} onChange={(e) => updateField('positionX', parseInt(e.target.value) || 0)} style={inputStyle} /></FormField>
                <FormField label="position.y"><input type="number" value={form.positionY} onChange={(e) => updateField('positionY', parseInt(e.target.value) || 0)} style={inputStyle} /></FormField>
              </div>
              <FormField label="description">
                <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} style={textareaStyle} />
              </FormField>
            </div>
          )}

          {/* WAVE設定 */}
          {activeTab === 'WAVE設定' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {form.nodeType === 'SAFE' ? (
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(139,0,255,0.1)', color: '#7878a8', fontSize: 14, textAlign: 'center' }}>
                  SAFEノードはWAVEなし
                </div>
              ) : (
                <>
                  {form.waves.map((wave, idx) => (
                    <div key={idx} style={{ padding: 14, background: 'rgba(139,0,255,0.05)', border: '1px solid rgba(139,0,255,0.15)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ color: '#d8b4fe', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
                          {wave.label || `WAVE ${idx + 1}`}
                        </span>
                        <button
                          onClick={() => updateField('waves', form.waves.filter((_, i) => i !== idx))}
                          style={{ background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.3)', color: '#fca5a5', borderRadius: 4, cursor: 'pointer', fontSize: 11, padding: '3px 8px' }}
                        >
                          削除
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <FormField label="role">
                          <select value={wave.role} onChange={(e) => updateWave(idx, { role: e.target.value })} style={selectStyle}>
                            {WAVE_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </FormField>
                        <FormField label={`敵編成（${wave.enemyIds.length}体選択中）`}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {enemyData.length === 0 ? (
                              <span style={{ color: '#7878a8', fontSize: 11 }}>敵データ読み込み中...</span>
                            ) : (
                              enemyData.map((enemy) => {
                                const selected = wave.enemyIds.includes(enemy.id);
                                const tierColor: Record<string, string> = { MINION: '#6b7280', ELITE: '#f97316', BOSS: '#dc2626' };
                                return (
                                  <button
                                    key={enemy.id}
                                    type="button"
                                    onClick={() => {
                                      const next = selected
                                        ? wave.enemyIds.filter((id) => id !== enemy.id)
                                        : [...wave.enemyIds, enemy.id];
                                      updateWave(idx, { enemyIds: next });
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '4px 8px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      fontSize: 11,
                                      fontFamily: 'Space Grotesk, sans-serif',
                                      background: selected ? 'rgba(139,0,255,0.22)' : 'rgba(255,255,255,0.04)',
                                      border: `1px solid ${selected ? 'rgba(139,0,255,0.55)' : 'rgba(255,255,255,0.1)'}`,
                                      color: selected ? '#d8b4fe' : '#7878a8',
                                      transition: 'all 0.12s ease',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 9,
                                        padding: '1px 4px',
                                        borderRadius: 3,
                                        background: `${tierColor[enemy.tier] ?? '#6b7280'}33`,
                                        color: tierColor[enemy.tier] ?? '#6b7280',
                                        fontFamily: 'monospace',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {enemy.tier}
                                    </span>
                                    <span style={{ fontSize: 11 }}>{enemy.nameJa}</span>
                                    <span style={{ fontSize: 9, opacity: 0.6, fontFamily: 'monospace' }}>{enemy.id}</span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                          {wave.enemyIds.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {wave.enemyIds.map((id) => (
                                <span key={id} style={{ fontSize: 10, fontFamily: 'monospace', color: '#8B00FF', background: 'rgba(139,0,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
                                  {id}
                                </span>
                              ))}
                            </div>
                          )}
                        </FormField>
                        <FormField label="intent">
                          <input type="text" value={wave.intent} onChange={(e) => updateWave(idx, { intent: e.target.value })} style={inputStyle} />
                        </FormField>
                      </div>
                    </div>
                  ))}
                  {form.waves.length < 3 && (
                    <button
                      onClick={() => updateField('waves', [...form.waves, { label: `WAVE ${form.waves.length + 1}`, role: 'WARMUP', enemyIds: [], intent: '' }])}
                      style={{ background: 'rgba(139,0,255,0.10)', border: '1px dashed rgba(139,0,255,0.3)', color: '#8B00FF', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    >
                      + WAVE追加
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* 依存関係 */}
          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}

          {/* 報酬 */}
          {activeTab === '報酬' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="baseExp">
                  <input type="number" value={form.baseExp} onChange={(e) => updateField('baseExp', parseInt(e.target.value) || 0)} style={inputStyle} />
                </FormField>
                <FormField label="baseGold">
                  <input type="number" value={form.baseGold} onChange={(e) => updateField('baseGold', parseInt(e.target.value) || 0)} style={inputStyle} />
                </FormField>
              </div>
              <div>
                <p style={{ color: '#7878a8', fontSize: 11, marginBottom: 8, fontFamily: 'Space Grotesk, sans-serif' }}>ドロップテーブル</p>
                <DropTableEditor
                  value={form.dropTable}
                  onChange={(entries) => updateField('dropTable', entries)}
                  itemIds={itemIds}
                  materialIds={materialIds}
                />
              </div>
            </div>
          )}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog open={showSaveConfirm} title="保存の確認" message={`"${form.id || entryKey}" を保存します。`} onConfirm={handleConfirmedSave} onCancel={() => setShowSaveConfirm(false)} />
      <ConfirmDialog open={showDeleteConfirm} title="削除の確認" message={`"${entryKey}" を削除します。この操作は取り消せません。`} onConfirm={handleConfirmedDelete} onCancel={() => setShowDeleteConfirm(false)} danger />
    </div>
  );
}
