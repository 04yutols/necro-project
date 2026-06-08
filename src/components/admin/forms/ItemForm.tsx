'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntry, deleteEntry } from '@/app/admin/actions';
import FormTabs from './shared/FormTabs';
import FormSaveBar from './shared/FormSaveBar';
import FormField from './shared/FormField';
import JsonSidebar from './shared/JsonSidebar';
import ConfirmDialog from './shared/ConfirmDialog';
import DependenciesTab from './shared/DependenciesTab';
import AIWeaponDraftPanel from '../AIWeaponDraftPanel';
import type { DependencyRef } from '@/app/admin/actions';
import type { ItemData, WeaponRarity, WeaponArchetype } from '@/types/game';
import {
  WEAPON_SUBOPTION_RULES,
  WEAPON_RARITY_LABEL,
  WEAPON_ARCHETYPE_LABEL,
  validateWeaponSubOptions,
  getWeaponEffectiveSubOptions,
  calculateWeaponBaseAttack,
  isElementDamageSubOption,
} from '@/logic/WeaponSystem';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = ['基本情報', 'サブオプション', 'パッシブ', '依存関係'];
const ITEM_TYPES = ['WEAPON', 'CONSUMABLE'];
const RARITIES: WeaponRarity[] = ['R', 'SR', 'SSR', 'UR'];
const ARCHETYPES: WeaponArchetype[] = ['LOW', 'MID', 'HIGH', 'MYTHIC'];
const PASSIVE_SYSTEM_TAGS = ['', 'DEMON_MODE', 'SOUL_SHATTER', 'ACTION_VALUE', 'SHIELD_PIERCE', 'GIANT_KILLING'];
const SUB_OPTION_NORMAL_TYPES = ['ATK%', 'ATK_FLAT', 'CRIT_RATE', 'CRIT_DMG', 'EFFECT_HIT', 'EFFECT_RES', 'DEF%'];
const SUB_OPTION_ELEMENT_TYPES = [
  'FIRE_DMG_BOOST', 'WATER_DMG_BOOST', 'THUNDER_DMG_BOOST', 'EARTH_DMG_BOOST',
  'WIND_DMG_BOOST', 'ICE_DMG_BOOST', 'LIGHT_DMG_BOOST', 'DARK_DMG_BOOST',
];

// ── Styles ────────────────────────────────────────────────────────────────────

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
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = {
  ...inputStyle, height: undefined, resize: 'vertical', minHeight: 96, padding: '10px 12px',
};

// ── Types ─────────────────────────────────────────────────────────────────────

type SubOption = { type: string; value: number };
type PassiveData = {
  nameJa: string;
  descTemplate: string;
  values: number[];
  condition?: string;
  systemTag?: string;
};
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPreviewItem(form: ItemFormState): ItemData {
  return {
    id: form.id,
    name: form.name,
    type: 'WEAPON',
    rarity: form.rarity,
    weaponRarity: form.rarity as WeaponRarity,
    archetype: form.archetype as WeaponArchetype,
    rank: form.rank,
    ilv: form.ilv,
    isUR: form.rarity === 'UR',
    isUnique: form.isUnique,
    stats: {},
    subOptions: form.subOptions,
  } as unknown as ItemData;
}

function passiveToObj(p: PassiveData): Record<string, unknown> {
  return {
    nameJa: p.nameJa,
    descTemplate: p.descTemplate,
    values: p.values,
    ...(p.condition ? { condition: p.condition } : {}),
    ...(p.systemTag ? { systemTag: p.systemTag } : {}),
  };
}

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
    passiveA: passiveToObj(form.passiveA),
    passiveB: passiveToObj(form.passiveB),
    flavor: form.flavor,
  };
}

function initPassive(data: Record<string, unknown> | undefined): PassiveData {
  if (!data) return { nameJa: '', descTemplate: '', values: [0, 0, 0, 0, 0] };
  return {
    nameJa: (data.nameJa as string) ?? '',
    descTemplate: (data.descTemplate as string) ?? '',
    values: (data.values as number[]) ?? [0, 0, 0, 0, 0],
    condition: (data.condition as string) || undefined,
    systemTag: (data.systemTag as string) || undefined,
  };
}

function initForm(data: Record<string, unknown> | null, key: string): ItemFormState {
  if (!data) {
    return {
      id: key, name: '', type: 'WEAPON', rarity: 'R', archetype: 'MID',
      rank: 0, ilv: 1, isUnique: false, flavor: '',
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
    rarity: (raw.weaponRarity as string) ?? (raw.rarity as string) ?? 'R',
    archetype: (raw.archetype as string) ?? 'MID',
    rank: (raw.rank as number) ?? 0,
    ilv: (raw.ilv as number) ?? 1,
    isUnique: (raw.isUnique as boolean) ?? false,
    flavor: (raw.flavor as string) ?? '',
    subOptions: (raw.subOptions as SubOption[]) ?? [],
    passiveA: initPassive(raw.passiveA as Record<string, unknown>),
    passiveB: initPassive(raw.passiveB as Record<string, unknown>),
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  initialData: Record<string, unknown> | null;
  entryKey: string;
  isNew: boolean;
  dependencies?: DependencyRef[];
};

// ── Component ─────────────────────────────────────────────────────────────────

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

  // ── Preview calculations ─────────────────────────────────────────────────────

  const isWeapon = form.type === 'WEAPON';
  const weaponRarity = form.rarity as WeaponRarity;
  const rule = WEAPON_SUBOPTION_RULES[weaponRarity] ?? WEAPON_SUBOPTION_RULES.R;

  const previewItem = useMemo(() => buildPreviewItem(form), [form]);

  const validationErrors = useMemo(
    () => (isWeapon ? validateWeaponSubOptions(previewItem) : []),
    [isWeapon, previewItem],
  );

  const effectiveSubOptions = useMemo(
    () => (isWeapon ? getWeaponEffectiveSubOptions(previewItem) : form.subOptions),
    [isWeapon, previewItem, form.subOptions],
  );

  const atkPreview = useMemo(() => {
    if (!isWeapon) return null;
    const atIlv1 = calculateWeaponBaseAttack({ ...previewItem, ilv: 1 } as ItemData);
    const atCurrent = calculateWeaponBaseAttack(previewItem);
    const atIlv90 = calculateWeaponBaseAttack({ ...previewItem, ilv: 90 } as ItemData);
    return { atIlv1, atCurrent, atIlv90 };
  }, [isWeapon, previewItem]);

  // ── Actions ──────────────────────────────────────────────────────────────────

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

  // ── Passive editor ───────────────────────────────────────────────────────────

  function renderPassiveEditor(which: 'passiveA' | 'passiveB', label: string) {
    const p = form[which];
    return (
      <div style={{ padding: 16, background: 'rgba(139,0,255,0.04)', border: '1px solid rgba(139,0,255,0.1)', borderRadius: 8 }}>
        <p style={{ color: '#d8b4fe', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, marginBottom: 12 }}>{label}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormField label="nameJa">
            <input type="text" value={p.nameJa} onChange={(e) => updatePassive(which, { nameJa: e.target.value })} style={inputStyle} />
          </FormField>
          <FormField label="descTemplate（{value} でプレースホルダ）">
            <input type="text" value={p.descTemplate} onChange={(e) => updatePassive(which, { descTemplate: e.target.value })} style={inputStyle} />
          </FormField>
          <div>
            <label style={{ color: '#7878a8', fontSize: 11, display: 'block', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>
              values [Rank1 〜 Rank5]
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {p.values.map((v, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#7878a8', fontSize: 10, textAlign: 'center' }}>R{idx + 1}</span>
                  <input
                    type="number"
                    value={v}
                    onChange={(e) => updatePassiveValue(which, idx, parseFloat(e.target.value) || 0)}
                    step={0.1}
                    style={{ ...inputStyle, padding: '6px', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="condition（任意）">
              <input
                type="text"
                value={p.condition ?? ''}
                onChange={(e) => updatePassive(which, { condition: e.target.value || undefined })}
                placeholder="例: BLEED, DEMON_ACTIVE"
                style={inputStyle}
              />
            </FormField>
            <FormField label="systemTag（任意）">
              <select
                value={p.systemTag ?? ''}
                onChange={(e) => updatePassive(which, { systemTag: e.target.value || undefined })}
                style={selectStyle}
              >
                {PASSIVE_SYSTEM_TAGS.map((t) => (
                  <option key={t} value={t} style={{ background: '#1a1a24' }}>{t || '—'}</option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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

      {isNew && (
        <AIWeaponDraftPanel
          onApply={(draft) => {
            const draftId = typeof draft.id === 'string' && draft.id ? draft.id : entryKey;
            setForm(initForm(draft, draftId));
            setActiveTab(TABS[0]);
            setError(null);
          }}
        />
      )}

      {error && (
        <div style={{
          background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(220,38,38,0.4)',
          borderRadius: 6, padding: '10px 14px', color: '#fca5a5', fontSize: 14, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div>
          <FormTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

          {/* ① 基本情報 */}
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
              <FormField label="name（アイテム名）">
                <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} style={inputStyle} />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="type">
                  <select value={form.type} onChange={(e) => updateField('type', e.target.value)} style={selectStyle}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t} style={{ background: '#1a1a24' }}>{t}</option>)}
                  </select>
                </FormField>
                <FormField label={`rarity — ${WEAPON_RARITY_LABEL[weaponRarity] ?? ''}`}>
                  <select value={form.rarity} onChange={(e) => updateField('rarity', e.target.value)} style={selectStyle}>
                    {RARITIES.map((r) => (
                      <option key={r} value={r} style={{ background: '#1a1a24' }}>{r} — {WEAPON_RARITY_LABEL[r]}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label={`archetype — ${WEAPON_ARCHETYPE_LABEL[form.archetype as WeaponArchetype] ?? ''}`}>
                  <select value={form.archetype} onChange={(e) => updateField('archetype', e.target.value)} style={selectStyle}>
                    {ARCHETYPES.map((a) => (
                      <option key={a} value={a} style={{ background: '#1a1a24' }}>{a} — {WEAPON_ARCHETYPE_LABEL[a]}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="rank（魂の共鳴 0〜5）">
                  <input
                    type="number"
                    value={form.rank}
                    onChange={(e) => updateField('rank', Math.min(5, Math.max(0, parseInt(e.target.value) || 0)))}
                    min={0} max={5}
                    style={inputStyle}
                  />
                </FormField>
                <FormField label="ilv（打ち直しレベル 1〜90）">
                  <input
                    type="number"
                    value={form.ilv}
                    onChange={(e) => updateField('ilv', Math.min(90, Math.max(1, parseInt(e.target.value) || 1)))}
                    min={1} max={90}
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#0d0d14', border: '1px solid rgba(139,0,255,0.12)', borderRadius: 6 }}>
                <input
                  type="checkbox"
                  id="isUnique"
                  checked={form.isUnique}
                  onChange={(e) => updateField('isUnique', e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#8B00FF', cursor: 'pointer' }}
                />
                <label htmlFor="isUnique" style={{ color: '#a5a9b4', fontSize: 14, cursor: 'pointer' }}>
                  isUnique（ユニーク装備 — 第一発見者システム）
                </label>
              </div>

              <FormField label="flavor（フレーバーテキスト）">
                <textarea value={form.flavor} onChange={(e) => updateField('flavor', e.target.value)} style={textareaStyle} />
              </FormField>

              {/* ATK preview */}
              {isWeapon && atkPreview && (
                <div style={{
                  padding: '14px 16px', background: '#0d0d14',
                  border: '1px solid rgba(139,0,255,0.2)', borderRadius: 8,
                }}>
                  <div style={{ fontSize: 11, color: '#8B00FF', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    武器基礎ATK プレビュー
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'ILv.1', value: atkPreview.atIlv1, muted: true },
                      { label: `ILv.${form.ilv} (現在)`, value: atkPreview.atCurrent, muted: false },
                      { label: 'ILv.90', value: atkPreview.atIlv90, muted: true },
                    ].map(({ label, value, muted }) => (
                      <div key={label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(139,0,255,0.06)', borderRadius: 6 }}>
                        <div style={{ fontSize: 10, color: '#7878a8', fontFamily: 'Space Mono, monospace', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: muted ? 20 : 26, fontFamily: 'Cinzel, serif', fontWeight: 700, color: muted ? '#8080a0' : '#c8b4f8' }}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ② サブオプション */}
          {activeTab === 'サブオプション' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Rarity rule info */}
              {isWeapon && (
                <div style={{
                  padding: '12px 16px', background: 'rgba(139,0,255,0.06)',
                  border: '1px solid rgba(139,0,255,0.15)', borderRadius: 8,
                  display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: '#d8b4fe', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
                    {form.rarity} — {WEAPON_RARITY_LABEL[weaponRarity]}
                  </span>
                  <span style={{ fontSize: 12, color: '#a0a0c0', fontFamily: 'Space Mono, monospace' }}>
                    通常枠 {rule.optionCount - rule.elementDamageOptionCount} + 属性枠 {rule.elementDamageOptionCount} = 計 {rule.optionCount}
                  </span>
                  <span style={{ fontSize: 12, color: '#7878a8', fontFamily: 'Space Mono, monospace' }}>
                    基準 ×{rule.baseMultiplier} / 節目成長 +{(rule.milestoneGrowthRate * 100).toFixed(0)}% / 20ILvごと
                  </span>
                </div>
              )}

              {/* Validation state */}
              {isWeapon && validationErrors.length > 0 && (
                <div style={{ padding: '10px 14px', background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8 }}>
                  {validationErrors.map((e, i) => (
                    <p key={i} style={{ color: '#fca5a5', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>
                      ⚠ {e}
                    </p>
                  ))}
                </div>
              )}
              {isWeapon && validationErrors.length === 0 && form.subOptions.length > 0 && (
                <div style={{ padding: '8px 14px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8 }}>
                  <p style={{ color: '#86efac', fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>
                    ✓ レアリティルールを満たしています
                  </p>
                </div>
              )}

              {/* Sub-option cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {form.subOptions.map((opt, idx) => {
                  const isElement = isElementDamageSubOption(opt);
                  const effectiveValue = effectiveSubOptions[idx]?.value ?? opt.value;
                  return (
                    <div key={idx} style={{
                      padding: '14px', background: '#111118',
                      border: `1px solid ${isElement ? 'rgba(251,191,36,0.25)' : 'rgba(139,0,255,0.18)'}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                          fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.04em',
                          background: isElement ? 'rgba(251,191,36,0.12)' : 'rgba(139,0,255,0.10)',
                          border: `1px solid ${isElement ? 'rgba(251,191,36,0.35)' : 'rgba(139,0,255,0.3)'}`,
                          color: isElement ? '#fbbf24' : '#d8b4fe',
                        }}>
                          {isElement ? '属性特化' : '通常'}
                        </span>
                        <span style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace', flex: 1 }}>
                          実効値 (ILv.{form.ilv}):&nbsp;
                          <span style={{ color: '#c8b4f8', fontWeight: 600 }}>{effectiveValue}</span>
                        </span>
                        <button
                          onClick={() => updateField('subOptions', form.subOptions.filter((_, i) => i !== idx))}
                          style={{
                            height: 28, width: 28, borderRadius: 6,
                            background: 'rgba(127,29,29,0.2)', border: '1px solid rgba(220,38,38,0.25)',
                            color: '#fca5a5', cursor: 'pointer', fontSize: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >×</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
                        <FormField label="タイプ">
                          <select value={opt.type} onChange={(e) => updateSubOption(idx, { type: e.target.value })} style={selectStyle}>
                            <optgroup label="通常ステータス">
                              {SUB_OPTION_NORMAL_TYPES.map((t) => (
                                <option key={t} value={t} style={{ background: '#1a1a24' }}>{t}</option>
                              ))}
                            </optgroup>
                            <optgroup label="属性ダメージ">
                              {SUB_OPTION_ELEMENT_TYPES.map((t) => (
                                <option key={t} value={t} style={{ background: '#1a1a24' }}>{t}</option>
                              ))}
                            </optgroup>
                          </select>
                        </FormField>
                        <FormField label="マスター値">
                          <input
                            type="number"
                            value={opt.value}
                            onChange={(e) => updateSubOption(idx, { value: parseFloat(e.target.value) || 0 })}
                            step={0.1}
                            style={inputStyle}
                          />
                        </FormField>
                      </div>
                    </div>
                  );
                })}
              </div>

              {form.subOptions.length === 0 && (
                <p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic', padding: '8px 0' }}>
                  サブオプションなし
                </p>
              )}

              {/* Add button */}
              <button
                onClick={() => updateField('subOptions', [...form.subOptions, { type: 'ATK%', value: 0 }])}
                disabled={isWeapon && form.subOptions.length >= rule.optionCount}
                style={{
                  padding: '8px 18px', borderRadius: 6, cursor: isWeapon && form.subOptions.length >= rule.optionCount ? 'not-allowed' : 'pointer',
                  background: isWeapon && form.subOptions.length >= rule.optionCount ? 'rgba(255,255,255,0.03)' : 'rgba(139,0,255,0.10)',
                  border: `1px dashed ${isWeapon && form.subOptions.length >= rule.optionCount ? 'rgba(255,255,255,0.08)' : 'rgba(139,0,255,0.3)'}`,
                  color: isWeapon && form.subOptions.length >= rule.optionCount ? '#444460' : '#8B00FF',
                  fontSize: 13, alignSelf: 'flex-start', fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {isWeapon && form.subOptions.length >= rule.optionCount
                  ? `上限 ${rule.optionCount} 枠`
                  : `+ サブオプション追加 (${form.subOptions.length}/${isWeapon ? rule.optionCount : '∞'})`}
              </button>
            </div>
          )}

          {/* ③ パッシブ */}
          {activeTab === 'パッシブ' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderPassiveEditor('passiveA', 'Passive A')}
              {renderPassiveEditor('passiveB', 'Passive B')}
            </div>
          )}

          {/* ④ 依存関係 */}
          {activeTab === '依存関係' && (
            <DependenciesTab refs={dependencies} />
          )}
        </div>

        <JsonSidebar data={formToJson(form)} />
      </div>

      <ConfirmDialog
        open={showSaveConfirm}
        title="保存の確認"
        message={`"${form.id || entryKey}" を保存します。`}
        onConfirm={handleConfirmedSave}
        onCancel={() => setShowSaveConfirm(false)}
      />
      <ConfirmDialog
        open={showDeleteConfirm}
        title="削除の確認"
        message={`"${entryKey}" を削除します。`}
        onConfirm={handleConfirmedDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        danger
      />
    </div>
  );
}
