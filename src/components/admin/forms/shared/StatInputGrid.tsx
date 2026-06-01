'use client';

const STAT_FIELDS: { key: string; label: string }[] = [
  { key: 'hp', label: 'HP' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
  { key: 'spd', label: 'SPD' },
  { key: 'critRate', label: 'CritRate %' },
  { key: 'critDmg', label: 'CritDmg %' },
  { key: 'effectHit', label: 'EffectHit %' },
  { key: 'effectRes', label: 'EffectRes %' },
];

const inputStyle: React.CSSProperties = {
  height: 44,
  background: '#0d0d14',
  border: '1px solid rgba(139,0,255,0.25)',
  borderRadius: 8,
  padding: '0 12px',
  color: '#e0d0ff',
  fontSize: 15,
  width: '100%',
  outline: 'none',
  fontFamily: 'Space Mono, monospace',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  color: '#a0a0c0',
  fontSize: 13,
  marginBottom: 6,
  display: 'block',
  fontFamily: 'Space Grotesk, sans-serif',
  fontWeight: 500,
};

type Props = {
  value: Record<string, number>;
  onChange: (key: string, val: number) => void;
};

export default function StatInputGrid({ value, onChange }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px 20px',
      }}
    >
      {STAT_FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label style={labelStyle}>{label}</label>
          <input
            type="number"
            value={value[key] ?? 0}
            onChange={(e) => onChange(key, parseFloat(e.target.value) || 0)}
            step={key === 'critRate' || key === 'critDmg' || key === 'effectHit' || key === 'effectRes' ? 0.1 : 1}
            style={inputStyle}
          />
        </div>
      ))}
    </div>
  );
}
