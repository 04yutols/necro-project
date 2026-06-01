'use client';

import { ElementBadge } from '../../Badges';

const ELEMENTS = ['FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK', 'NONE'];

const inputStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid rgba(139,0,255,0.2)',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 12,
  width: '80px',
  outline: 'none',
  fontFamily: 'monospace',
  textAlign: 'right',
};

type Props = {
  value: Record<string, number>;
  onChange: (element: string, val: number) => void;
};

export default function ResistanceGrid({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ color: '#7878a8', fontSize: 11, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>
        負の値 = 弱点（ダメージ増）、正の値 = 耐性（ダメージ減）
      </p>
      {ELEMENTS.map((el) => {
        const v = value[el] ?? 0;
        const color = v < 0 ? '#fca5a5' : v > 0 ? '#93c5fd' : '#7878a8';
        return (
          <div key={el} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 80, flexShrink: 0 }}>
              <ElementBadge element={el} />
            </div>
            <input
              type="number"
              value={v}
              onChange={(e) => onChange(el, parseInt(e.target.value) || 0)}
              min={-100}
              max={100}
              step={5}
              style={{ ...inputStyle, color }}
            />
            <span style={{ color: '#7878a8', fontSize: 11, fontFamily: 'monospace' }}>%</span>
            {v !== 0 && (
              <span style={{ fontSize: 11, color, fontFamily: 'Space Grotesk, sans-serif' }}>
                {v < 0 ? `弱点 (${v}%)` : `耐性 (+${v}%)`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
