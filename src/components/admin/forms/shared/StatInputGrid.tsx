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
  background: '#1a1a24',
  border: '1px solid rgba(139,0,255,0.2)',
  borderRadius: 6,
  padding: '8px 10px',
  color: '#e0d0ff',
  fontSize: 13,
  width: '100%',
  outline: 'none',
  fontFamily: 'monospace',
};

const labelStyle: React.CSSProperties = {
  color: '#7878a8',
  fontSize: 11,
  marginBottom: 4,
  display: 'block',
  fontFamily: 'Space Grotesk, sans-serif',
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
        gap: '12px 16px',
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
