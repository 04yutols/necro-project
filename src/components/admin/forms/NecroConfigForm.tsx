'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveNecroConfig } from '@/app/admin/actions';
import {
  applyNecroRankToCaptureRate,
  calcNecroMaxCost,
  deriveNecroRank,
  necroMonsterMultiplier,
  reqNecroExp,
} from '@/logic/NecroGrowthSystem';
import type { NecroConfigData } from '@/types/game';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 42,
  borderRadius: 6,
  border: '1px solid rgba(139,0,255,0.24)',
  background: '#12121a',
  color: '#e0d0ff',
  padding: '0 10px',
  fontFamily: 'monospace',
  fontSize: 13,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  color: '#9183ad',
  fontSize: 11,
  fontFamily: 'Space Grotesk, sans-serif',
  marginBottom: 6,
};

type NumberPath =
  | ['monsterStatMultiplier', 'kA' | 'kB' | 'k2']
  | ['maxCost', 'base' | 'd1' | 'c2']
  | ['captureRate', 'rankMultiplier' | 'cap']
  | ['expCurve', 'coefficient' | 'necroExpRate'];

function setConfigNumber(config: NecroConfigData, path: NumberPath, value: number): NecroConfigData {
  const [section, key] = path;
  return {
    ...config,
    [section]: {
      ...config[section],
      [key]: value,
    },
  };
}

function Field({ label, value, step, onChange }: { label: string; value: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label>
      <div style={labelStyle}>{label}</div>
      <input
        type="number"
        value={value}
        step={step ?? 0.001}
        onChange={(event) => onChange(Number(event.target.value))}
        style={inputStyle}
      />
    </label>
  );
}

export default function NecroConfigForm({ initialConfig }: { initialConfig: NecroConfigData }) {
  const router = useRouter();
  const [config, setConfig] = useState<NecroConfigData>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const levels = [1, 10, 30, 50, 51, 100, 500];

  const preview = useMemo(() => ({
    rows: levels.map((level) => ({
      level,
      rank: deriveNecroRank(level),
      mult: necroMonsterMultiplier(level, config),
      maxCost: calcNecroMaxCost(level, config),
    })),
    rates: [0.12, 0.04, 0.001, 0.4].map((baseRate) => ({
      baseRate,
      rank1: applyNecroRankToCaptureRate(baseRate, 1, config),
      rank5: applyNecroRankToCaptureRate(baseRate, 5, config),
      rank10: applyNecroRankToCaptureRate(baseRate, 10, config),
    })),
    exp100: reqNecroExp(100, config),
    exp500: reqNecroExp(500, config),
  }), [config]);

  const update = (path: NumberPath, value: number) => {
    setConfig((current) => setConfigNumber(current, path, Number.isFinite(value) ? value : 0));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const result = await saveNecroConfig(config);
    setSaving(false);
    if (result.success) {
      setMessage('保存しました。');
      router.refresh();
    } else {
      setMessage(result.error ?? '保存に失敗しました。');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-cinzel text-xl font-bold tracking-widest uppercase" style={{ color: '#e0d0ff' }}>
          NECRO CONFIG
        </h1>
        <p className="text-xs font-space mt-1" style={{ color: '#7878a8' }}>
          死霊術Lv/Rankの係数を調整します。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ background: '#101018', border: '1px solid rgba(139,0,255,0.18)', borderRadius: 8, padding: 16 }}>
            <h2 style={{ color: '#c8b4f8', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>モンスターステ倍率</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <Field label="kA (Lv1-50)" value={config.monsterStatMultiplier.kA} onChange={(value) => update(['monsterStatMultiplier', 'kA'], value)} />
              <Field label="kB (Lv51+)" value={config.monsterStatMultiplier.kB} onChange={(value) => update(['monsterStatMultiplier', 'kB'], value)} />
              <Field label="k2 (Rank)" value={config.monsterStatMultiplier.k2} onChange={(value) => update(['monsterStatMultiplier', 'k2'], value)} />
            </div>
          </section>

          <section style={{ background: '#101018', border: '1px solid rgba(139,0,255,0.18)', borderRadius: 8, padding: 16 }}>
            <h2 style={{ color: '#c8b4f8', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>maxCost</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <Field label="base" value={config.maxCost.base} step={1} onChange={(value) => update(['maxCost', 'base'], value)} />
              <Field label="d1" value={config.maxCost.d1} step={1} onChange={(value) => update(['maxCost', 'd1'], value)} />
              <Field label="c2" value={config.maxCost.c2} step={1} onChange={(value) => update(['maxCost', 'c2'], value)} />
            </div>
          </section>

          <section style={{ background: '#101018', border: '1px solid rgba(139,0,255,0.18)', borderRadius: 8, padding: 16 }}>
            <h2 style={{ color: '#c8b4f8', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>捕獲率 / EXP曲線</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <Field label="rankMultiplier" value={config.captureRate.rankMultiplier} onChange={(value) => update(['captureRate', 'rankMultiplier'], value)} />
              <Field label="cap" value={config.captureRate.cap} onChange={(value) => update(['captureRate', 'cap'], value)} />
              <Field label="coefficient" value={config.expCurve.coefficient} step={1} onChange={(value) => update(['expCurve', 'coefficient'], value)} />
              <Field label="necroExpRate" value={config.expCurve.necroExpRate} onChange={(value) => update(['expCurve', 'necroExpRate'], value)} />
            </div>
          </section>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              style={{
                height: 42,
                padding: '0 18px',
                borderRadius: 7,
                border: '1px solid rgba(139,0,255,0.42)',
                background: saving ? 'rgba(255,255,255,0.05)' : 'rgba(139,0,255,0.2)',
                color: saving ? '#7878a8' : '#e0d0ff',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {message && <span style={{ color: message.includes('失敗') || message.includes('必要') ? '#fca5a5' : '#86efac', fontSize: 12 }}>{message}</span>}
          </div>
        </div>

        <aside style={{ background: '#0e0e16', border: '1px solid rgba(139,0,255,0.22)', borderRadius: 8, padding: 16 }}>
          <h2 style={{ color: '#c8b4f8', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>成長試算</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
            <thead style={{ color: '#7878a8' }}>
              <tr><th align="left">Lv</th><th align="left">Rank</th><th align="left">mult</th><th align="left">Cost</th></tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.level} style={{ color: '#e0d0ff', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td>Lv{row.level}</td>
                  <td>R{row.rank}</td>
                  <td>x{row.mult.toFixed(3)}</td>
                  <td>{row.maxCost}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 style={{ color: '#c8b4f8', fontSize: 13, fontWeight: 800, margin: '18px 0 12px' }}>捕獲率</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 12 }}>
            <thead style={{ color: '#7878a8' }}>
              <tr><th align="left">base</th><th align="left">R1</th><th align="left">R5</th><th align="left">R10</th></tr>
            </thead>
            <tbody>
              {preview.rates.map((row) => (
                <tr key={row.baseRate} style={{ color: '#e0d0ff', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td>{(row.baseRate * 100).toFixed(row.baseRate < 0.01 ? 3 : 1)}%</td>
                  <td>{(row.rank1 * 100).toFixed(2)}%</td>
                  <td>{(row.rank5 * 100).toFixed(2)}%</td>
                  <td>{(row.rank10 * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 18, color: '#a999c8', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8 }}>
            <div>Lv100 EXP: {preview.exp100.toLocaleString()}</div>
            <div>Lv500 EXP: {preview.exp500.toLocaleString()}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
