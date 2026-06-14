'use client';

import {
  DROP_ROLL_MODE,
  formatDropRate,
  normalizeDropRate,
  summarizeDropTable,
} from '@/logic/DropPolicySystem';
import type { DropEntry as GameDropEntry } from '@/types/game';

export type DropEntry = GameDropEntry & {
  type: NonNullable<GameDropEntry['type']>;
  rarity: string;
};

const DROP_TYPES: DropEntry['type'][] = ['WEAPON', 'MATERIAL', 'RESIDUE', 'CONSUMABLE'];
const EXTENDED_DROP_TYPES: DropEntry['type'][] = ['WEAPON', 'MATERIAL', 'WEAPON_MATERIAL', 'RESIDUE', 'CONSUMABLE', 'MONSTER'];
const RARITIES = ['COMMON', 'R', 'SR', 'SSR', 'RARE', 'EPIC', 'LEGENDARY'];
const WEAPON_MATERIAL_TYPES = ['IDEA_COMMON', 'IDEA_SR', 'IDEA_SSR', 'ABYSSAL_OBSIDIAN'];

const inputStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid rgba(139,0,255,0.2)',
  borderRadius: 6,
  padding: '6px 8px',
  color: '#e0d0ff',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'monospace',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

type Props = {
  value: DropEntry[];
  onChange: (entries: DropEntry[]) => void;
  itemIds: string[];
  materialIds: string[];
  enemyIds?: string[];
  allowExtendedTypes?: boolean;
};

export default function DropTableEditor({ value, onChange, itemIds, materialIds, enemyIds = [], allowExtendedTypes = false }: Props) {
  const summary = summarizeDropTable(value);
  const dropTypes = allowExtendedTypes ? EXTENDED_DROP_TYPES : DROP_TYPES;

  function update(idx: number, patch: Partial<DropEntry>) {
    const normalizedPatch = patch.rate === undefined
      ? patch
      : { ...patch, rate: normalizeDropRate(patch.rate) };
    const next = value.map((e, i) => (i === idx ? { ...e, ...normalizedPatch } : e));
    onChange(next);
  }

  function addRow() {
    onChange([...value, { type: 'WEAPON', itemId: '', rarity: 'R', rate: 0.5 }]);
  }

  function removeRow(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function getItemOptions(type: string): string[] {
    if (type === 'WEAPON' || type === 'CONSUMABLE') return itemIds;
    if (type === 'MATERIAL') return materialIds;
    if (type === 'WEAPON_MATERIAL') return WEAPON_MATERIAL_TYPES;
    if (type === 'MONSTER') return enemyIds;
    return [];
  }

  function getReferenceValue(entry: DropEntry): string {
    if (entry.type === 'MONSTER') return entry.monsterId ?? '';
    if (entry.type === 'WEAPON_MATERIAL') return entry.weaponMaterialType ?? entry.itemId ?? '';
    return entry.itemId ?? '';
  }

  function updateReference(idx: number, entry: DropEntry, value: string) {
    if (entry.type === 'MONSTER') {
      update(idx, { monsterId: value, itemId: '' });
      return;
    }
    if (entry.type === 'WEAPON_MATERIAL') {
      update(idx, { weaponMaterialType: value as DropEntry['weaponMaterialType'], itemId: '' });
      return;
    }
    update(idx, { itemId: value });
  }

  return (
    <div>
      {value.length === 0 ? (
        <p style={{ color: '#7878a8', fontSize: 12, fontStyle: 'italic', marginBottom: 12 }}>ドロップなし</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 80px 70px 96px 60px 32px',
              gap: 6,
              paddingBottom: 4,
              borderBottom: '1px solid rgba(139,0,255,0.1)',
            }}
          >
            {['タイプ', '参照ID', 'レアリティ', '数量', '確率', '非表示', ''].map((h) => (
              <span key={h} style={{ color: '#7878a8', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>
                {h}
              </span>
            ))}
          </div>

          {value.map((entry, idx) => (
            <div
              key={idx}
              style={{
                display: 'grid',
              gridTemplateColumns: '120px 1fr 80px 70px 96px 60px 32px',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <select
                value={entry.type}
                onChange={(e) => update(idx, {
                  type: e.target.value as DropEntry['type'],
                  itemId: '',
                  monsterId: '',
                  weaponMaterialType: undefined,
                })}
                style={selectStyle}
              >
                {dropTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {entry.type === 'RESIDUE' ? (
                <span style={{ color: '#7878a8', fontSize: 11, padding: '6px 8px' }}>（自動生成）</span>
              ) : (
                <select
                  value={getReferenceValue(entry)}
                  onChange={(e) => updateReference(idx, entry, e.target.value)}
                  style={selectStyle}
                >
                  <option value="">-- 選択 --</option>
                  {getItemOptions(entry.type).map((id) => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              )}

              <select
                value={entry.rarity}
                onChange={(e) => update(idx, { rarity: e.target.value })}
                style={selectStyle}
              >
                {RARITIES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <input
                type="number"
                value={entry.quantity ?? 1}
                onChange={(e) => update(idx, { quantity: Math.max(1, Number.parseInt(e.target.value, 10) || 1) })}
                min={1}
                step={1}
                style={inputStyle}
              />

              <div style={{ display: 'grid', gap: 3 }}>
                <input
                  type="number"
                  value={entry.rate}
                  onChange={(e) => update(idx, { rate: Number.parseFloat(e.target.value) || 0 })}
                  min={0}
                  max={1}
                  step={0.01}
                  style={inputStyle}
                />
                <span style={{ color: '#A5A9B4', fontSize: 10, fontFamily: 'Space Grotesk, sans-serif' }}>
                  {formatDropRate(entry.rate)}
                </span>
              </div>

              <input
                type="checkbox"
                checked={entry.isHidden ?? false}
                onChange={(e) => update(idx, { isHidden: e.target.checked })}
                style={{ cursor: 'pointer', accentColor: '#8B00FF', width: 16, height: 16 }}
              />

              <button
                onClick={() => removeRow(idx)}
                style={{
                  background: 'rgba(127,29,29,0.3)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  color: '#fca5a5',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            marginBottom: 12,
            padding: '8px 10px',
            background: 'rgba(139,0,255,0.06)',
            border: '1px solid rgba(139,0,255,0.16)',
            borderRadius: 6,
            color: '#A5A9B4',
            fontSize: 11,
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          <strong style={{ color: '#D4AF37', fontSize: 11 }}>
            {DROP_ROLL_MODE === 'MULTI_ROLL' ? '複数抽選' : '単一抽選'}
          </strong>
          <span>期待値 {formatDropRate(summary.expectedDrops)}</span>
          <span>表示分 {formatDropRate(summary.visibleExpectedDrops)}</span>
          {summary.hiddenCount > 0 && <span>非表示 {summary.hiddenCount}件</span>}
        </div>
      )}

      <button
        onClick={addRow}
        style={{
          background: 'rgba(139,0,255,0.10)',
          border: '1px dashed rgba(139,0,255,0.3)',
          color: '#8B00FF',
          padding: '6px 14px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontFamily: 'Space Grotesk, sans-serif',
        }}
      >
        + 行を追加
      </button>
    </div>
  );
}
