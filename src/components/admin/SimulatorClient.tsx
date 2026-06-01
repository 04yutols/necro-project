'use client';

import { useState, useMemo } from 'react';
import { calculateBattleDamage } from '@/logic/BattleDamage';
import { calculateJobAdjustedStats } from '@/logic/JobSystem';
import { INITIAL_PLAYER_BASE_STATS } from '@/logic/BalanceConfig';
import type { ElementType, BaseStats } from '@/types/game';

// ── Types ─────────────────────────────────────────────────────────────────────

type JobEntry = {
  displayName: string;
  statModifiers?: Record<string, number>;
  levelBonuses?: Record<string, Record<string, number>>;
  skills?: { level: number; skillId: string }[];
};

type SkillEntry = {
  id: string;
  name: string;
  power?: number;
  element?: string;
  mpCost?: number;
  description?: string;
};

type EnemyEntry = {
  nameJa?: string;
  tier?: string;
  tribe?: string;
  stats?: Partial<BaseStats>;
  resistances?: Record<string, number>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const ELEMENTS: ElementType[] = [
  'NONE', 'FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK',
];

const ELEM_COLOR: Record<string, string> = {
  FIRE: '#f87171', WATER: '#60a5fa', THUNDER: '#fbbf24', EARTH: '#a78bfa',
  WIND: '#4ade80', ICE: '#67e8f9', LIGHT: '#fde68a', DARK: '#c084fc', NONE: '#7878a8',
};

const TIER_COLOR: Record<string, string> = {
  MINION: '#7878a8', ELITE: '#fbbf24', BOSS: '#f87171', FINAL_BOSS: '#c084fc',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computePassiveAtk(jobEntry: JobEntry, level: number): number {
  let bonus = 0;
  if (!jobEntry.levelBonuses) return 0;
  for (let lv = 1; lv <= level; lv++) {
    const b = jobEntry.levelBonuses[lv.toString()];
    if (b?.passiveAtkBonus) bonus += b.passiveAtkBonus as number;
  }
  return bonus;
}

function computeJobStats(jobEntry: JobEntry, level: number) {
  const jobData = {
    statModifiers: jobEntry.statModifiers ?? {},
    levelBonuses: jobEntry.levelBonuses ?? {},
  };
  const jobStats = calculateJobAdjustedStats(
    INITIAL_PLAYER_BASE_STATS,
    jobData as Parameters<typeof calculateJobAdjustedStats>[1],
  );
  const passiveAtk = computePassiveAtk(jobEntry, level);
  return {
    atk: jobStats.atk + passiveAtk,
    critRate: jobStats.critRate,
    critDmg: jobStats.critDmg,
    def: jobStats.def,
    hp: jobStats.hp,
    spd: jobStats.spd,
  };
}

function simulate(
  atk: number,
  critRate: number,
  critDmg: number,
  elementBoostPct: number,
  def: number,
  resistance: number,
  power: number,
  element: ElementType,
) {
  const attackerStats: BaseStats = { ...INITIAL_PLAYER_BASE_STATS, atk, critRate, critDmg };
  const defenderStats: BaseStats = { ...INITIAL_PLAYER_BASE_STATS, def };
  const defenderResistances: Record<string, number> = { [element]: resistance };
  const attackerElementBoosts: Partial<Record<ElementType, number>> = { [element]: elementBoostPct };

  const normalResult = calculateBattleDamage({
    attackerStats, attackerElementBoosts, defenderStats, defenderResistances,
    powerMultiplier: power, element, rng: () => 1,
  });
  const critResult = calculateBattleDamage({
    attackerStats, attackerElementBoosts, defenderStats, defenderResistances,
    powerMultiplier: power, element, rng: () => 0,
  });

  const critRateFrac = Math.min(100, Math.max(0, critRate)) / 100;
  const expected = Math.round(
    normalResult.damage * (1 - critRateFrac) + critResult.damage * critRateFrac,
  );

  const baseDmg = atk * power;
  const rawDef = Math.max(0, def);
  const defMult = 1 - rawDef / (rawDef + 200);
  const elemMult = 1 + elementBoostPct / 100;
  const resistMult = 1 - resistance / 100;

  return {
    normal: normalResult.damage,
    critical: critResult.damage,
    expected,
    baseDmg,
    defMult,
    elemMult,
    resistMult,
    isWeakness: resistance < 0,
    isResisted: resistance > 0,
  };
}

// ── Shared styled primitives ──────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 14px',
  background: '#0a0a12',
  border: '1px solid rgba(139,0,255,0.3)',
  borderRadius: 8,
  color: '#e0d0ff',
  fontSize: 15,
  fontFamily: 'Space Mono, monospace',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: '#9090b0',
  fontFamily: 'Space Mono, monospace',
  letterSpacing: '0.05em',
  marginBottom: 6,
  display: 'block',
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: '#555570', fontFamily: 'Space Mono, monospace', marginTop: 4 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function StyledSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      style={{ ...INPUT_STYLE, cursor: 'pointer', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%238B00FF' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 14px center',
        paddingRight: 36,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: '#0d0d14' }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NumField({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={INPUT_STYLE}
    />
  );
}

function ResetBtn({ onClick, label = '↺ 自動値にリセット' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        height: 40,
        padding: '0 16px',
        fontSize: 13,
        fontFamily: 'Space Mono, monospace',
        background: 'rgba(139,0,255,0.1)',
        border: '1px solid rgba(139,0,255,0.28)',
        borderRadius: 8,
        color: '#a080d0',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,0,255,0.2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,0,255,0.1)';
      }}
    >
      {label}
    </button>
  );
}

function SectionTitle({ step, title, color = '#8B00FF' }: { step: string; title: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <span
        style={{
          width: 28, height: 28,
          borderRadius: '50%',
          background: `${color}28`,
          border: `1px solid ${color}60`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
          color, flexShrink: 0,
          fontFamily: 'Space Mono, monospace',
        }}
      >
        {step}
      </span>
      <span
        style={{
          fontSize: 13, fontWeight: 600,
          color: '#d0c0f0',
          fontFamily: 'Space Mono, monospace',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
    </div>
  );
}

function StatPill({ label, value, dim = false }: { label: string; value: string | number; dim?: boolean }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 12px',
        background: dim ? '#0a0a12' : 'rgba(139,0,255,0.08)',
        border: `1px solid ${dim ? 'rgba(139,0,255,0.1)' : 'rgba(139,0,255,0.22)'}`,
        borderRadius: 8, flex: 1, minWidth: 60,
      }}
    >
      <span style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace' }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700, color: dim ? '#7878a8' : '#e0d0ff', fontFamily: 'Space Mono, monospace' }}>
        {value}
      </span>
    </div>
  );
}

// ── Result number card ────────────────────────────────────────────────────────

function DmgCard({
  label, value, color, barPct, sub,
}: {
  label: string; value: number; color: string; barPct: number; sub?: string;
}) {
  return (
    <div
      style={{
        background: '#111118',
        border: `1px solid ${color}30`,
        borderRadius: 12,
        padding: '20px 20px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 12, color: '#9090b0', fontFamily: 'Space Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color, fontFamily: 'Space Mono, monospace' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#666688', fontFamily: 'Space Mono, monospace' }}>{sub}</div>
      )}
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, barPct)}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

// ── Formula chain ─────────────────────────────────────────────────────────────

function FormulaStep({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, color: '#555570', fontFamily: 'Space Mono, monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 18, fontWeight: 700,
          color: highlight ? '#e0d0ff' : '#a090c8',
          fontFamily: 'Space Mono, monospace',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Arrow() {
  return (
    <span style={{ color: '#444460', fontSize: 16, fontFamily: 'monospace', paddingTop: 18, flexShrink: 0 }}>→</span>
  );
}

// ── Level slider ──────────────────────────────────────────────────────────────

function LevelSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...LABEL_STYLE, marginBottom: 0 }}>レベル</span>
        <span
          style={{
            fontSize: 22, fontWeight: 700, color: '#c084fc',
            fontFamily: 'Space Mono, monospace',
            background: 'rgba(192,132,252,0.12)',
            border: '1px solid rgba(192,132,252,0.3)',
            borderRadius: 8, padding: '2px 14px',
          }}
        >
          Lv.{value}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={30}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          height: 6,
          accentColor: '#8B00FF',
          cursor: 'pointer',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555570', fontFamily: 'Space Mono, monospace' }}>
        <span>1</span>
        <span>10</span>
        <span>20</span>
        <span>30</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SimulatorClient({
  jobsData,
  skillsData,
  enemiesData,
}: {
  jobsData: Record<string, unknown>;
  skillsData: Record<string, unknown>;
  enemiesData: Record<string, unknown>;
}) {
  const jobs = jobsData as Record<string, JobEntry>;
  const skills = skillsData as Record<string, SkillEntry>;
  const enemies = enemiesData as Record<string, EnemyEntry>;

  const jobIds = Object.keys(jobs);
  const enemyIds = Object.keys(enemies);

  // ── Attacker state
  const [jobId, setJobId] = useState<string>(jobIds[0] ?? 'warrior');
  const [level, setLevel] = useState(1);
  const [manualAtk, setManualAtk] = useState<number | null>(null);
  const [manualCritRate, setManualCritRate] = useState<number | null>(null);
  const [manualCritDmg, setManualCritDmg] = useState<number | null>(null);
  const [elementBoostPct, setElementBoostPct] = useState(0);

  // ── Skill state
  const [skillId, setSkillId] = useState<string>('');
  const [manualPower, setManualPower] = useState<number | null>(null);
  const [manualElement, setManualElement] = useState<ElementType | null>(null);

  // ── Defender state
  const [enemyId, setEnemyId] = useState<string>(enemyIds[0] ?? 'grave_soldier');
  const [useCustomDef, setUseCustomDef] = useState(false);
  const [customDef, setCustomDef] = useState(5);
  const [customResistance, setCustomResistance] = useState(0);

  // ── Derived
  const jobEntry = jobs[jobId] ?? ({} as JobEntry);
  const autoStats = useMemo(() => computeJobStats(jobEntry, level), [jobEntry, level]);

  const jobSkillIds = useMemo(() => (jobEntry.skills ?? []).map((s) => s.skillId), [jobEntry]);
  const resolvedSkillId = useMemo(() => {
    if (skillId && jobSkillIds.includes(skillId)) return skillId;
    return jobSkillIds[0] ?? '';
  }, [skillId, jobSkillIds]);

  const skillEntry = skills[resolvedSkillId] ?? ({} as SkillEntry);

  const atk = manualAtk !== null ? manualAtk : autoStats.atk;
  const critRate = manualCritRate !== null ? manualCritRate : autoStats.critRate;
  const critDmg = manualCritDmg !== null ? manualCritDmg : autoStats.critDmg;
  const power = manualPower !== null ? manualPower : (skillEntry.power ?? 1.0);
  const element: ElementType = manualElement !== null
    ? manualElement
    : ((skillEntry.element ?? 'NONE') as ElementType);

  const enemyEntry = enemies[enemyId] ?? ({} as EnemyEntry);
  const def = useCustomDef ? customDef : (enemyEntry.stats?.def ?? 5);
  const autoResistance = (enemyEntry.resistances ?? {})[element] ?? 0;
  const resistance = useCustomDef ? customResistance : autoResistance;

  const result = useMemo(
    () => simulate(atk, critRate, critDmg, elementBoostPct, def, resistance, power, element),
    [atk, critRate, critDmg, elementBoostPct, def, resistance, power, element],
  );

  const isAtkOverridden = manualAtk !== null;
  const isCritOverridden = manualCritRate !== null || manualCritDmg !== null;

  // Options
  const jobOptions = jobIds.map((id) => ({
    value: id,
    label: `${jobs[id]?.displayName ?? id}`,
  }));

  const skillOptions = useMemo(() =>
    jobSkillIds
      .filter((id) => skills[id])
      .map((id) => {
        const s = skills[id];
        const lv = (jobEntry.skills ?? []).find((e) => e.skillId === id)?.level ?? 1;
        return {
          value: id,
          label: `Lv${lv} ${s.name}  [×${s.power ?? 1.0} / ${s.element ?? 'NONE'}]`,
        };
      }),
  [jobSkillIds, skills, jobEntry]);

  const enemyOptions = enemyIds.map((id) => {
    const e = enemies[id];
    return { value: id, label: `${e?.nameJa ?? id}  (DEF ${e?.stats?.def ?? '?'})` };
  });

  const elemColor = ELEM_COLOR[element] ?? '#7878a8';
  const tierColor = TIER_COLOR[enemyEntry.tier ?? ''] ?? '#7878a8';

  const critRateFrac = Math.min(100, Math.max(0, critRate)) / 100;

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '32px 24px',
        display: 'grid',
        gridTemplateColumns: '420px 1fr',
        gap: 28,
        alignItems: 'start',
      }}
    >
      {/* ── LEFT: Inputs ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* Page title */}
        <div style={{ marginBottom: 24 }}>
          <h1
            style={{
              fontSize: 22,
              fontFamily: 'Cinzel, serif',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#e0d0ff',
              textShadow: '0 0 20px rgba(139,0,255,0.5)',
              margin: 0,
            }}
          >
            DAMAGE SIMULATOR
          </h1>
          <p style={{ fontSize: 12, color: '#7878a8', fontFamily: 'Space Mono, monospace', marginTop: 6 }}>
            calculateBattleDamage — リアルタイム計算
          </p>
        </div>

        {/* ①  ATTACKER */}
        <div
          style={{
            background: '#111118',
            border: '1px solid rgba(139,0,255,0.2)',
            borderRadius: 12,
            padding: '22px 22px 18px',
            display: 'flex', flexDirection: 'column', gap: 18,
            marginBottom: 12,
          }}
        >
          <SectionTitle step="①" title="アタッカー" />

          <Field label="職業">
            <StyledSelect
              value={jobId}
              options={jobOptions}
              onChange={(v) => {
                setJobId(v);
                setManualAtk(null);
                setManualCritRate(null);
                setManualCritDmg(null);
                setSkillId('');
                setManualPower(null);
                setManualElement(null);
              }}
            />
          </Field>

          <LevelSlider value={level} onChange={setLevel} />

          {/* Auto stat overview */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatPill label="ATK" value={autoStats.atk} dim={isAtkOverridden} />
            <StatPill label="CRIT%" value={`${autoStats.critRate}`} dim={isCritOverridden} />
            <StatPill label="CRIT×" value={`${autoStats.critDmg}%`} dim={isCritOverridden} />
            <StatPill label="SPD" value={autoStats.spd} dim />
          </div>

          {/* Manual override section */}
          <details style={{ cursor: 'pointer' }}>
            <summary
              style={{
                fontSize: 12,
                color: (isAtkOverridden || isCritOverridden) ? '#c084fc' : '#7878a8',
                fontFamily: 'Space Mono, monospace',
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 0',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 14 }}>{(isAtkOverridden || isCritOverridden) ? '▲' : '▶'}</span>
              ステータス手動上書き{(isAtkOverridden || isCritOverridden) ? '（変更中）' : ''}
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
              <Field label={`ATK（自動: ${autoStats.atk}）`} hint={isAtkOverridden ? `上書き値: ${atk}` : undefined}>
                <NumField value={atk} onChange={setManualAtk} min={1} />
              </Field>
              <Field label={`会心率 %（自動: ${autoStats.critRate}）`}>
                <NumField value={critRate} onChange={setManualCritRate} min={0} max={100} step={0.1} />
              </Field>
              <Field label={`会心倍率 %（自動: ${autoStats.critDmg}）`}>
                <NumField value={critDmg} onChange={setManualCritDmg} min={100} max={500} />
              </Field>
              <Field label="属性ダメージ加成 %">
                <NumField value={elementBoostPct} onChange={setElementBoostPct} min={0} max={200} />
              </Field>
              <ResetBtn
                onClick={() => { setManualAtk(null); setManualCritRate(null); setManualCritDmg(null); }}
                label="↺ 自動値にリセット"
              />
            </div>
          </details>
        </div>

        {/* ② SKILL */}
        <div
          style={{
            background: '#111118',
            border: '1px solid rgba(139,0,255,0.2)',
            borderRadius: 12,
            padding: '22px 22px 18px',
            display: 'flex', flexDirection: 'column', gap: 18,
            marginBottom: 12,
          }}
        >
          <SectionTitle step="②" title="スキル" />

          <Field label="スキル選択">
            <StyledSelect
              value={resolvedSkillId}
              options={skillOptions}
              onChange={(v) => { setSkillId(v); setManualPower(null); setManualElement(null); }}
            />
          </Field>

          {/* Skill info card */}
          {skillEntry.name && (
            <div
              style={{
                background: '#0a0a12',
                border: '1px solid rgba(139,0,255,0.15)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                gap: 16,
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#d8c8f8', fontFamily: 'Space Mono, monospace', marginBottom: 4 }}>
                  {skillEntry.name}
                </div>
                {skillEntry.description && (
                  <div style={{ fontSize: 11, color: '#7878a8', lineHeight: 1.5 }}>
                    {skillEntry.description}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'flex-end' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#e0d0ff', fontFamily: 'Space Mono, monospace' }}>
                  ×{skillEntry.power ?? '—'}
                </span>
                <span
                  style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: `${elemColor}20`, border: `1px solid ${elemColor}50`,
                    color: elemColor, fontFamily: 'Space Mono, monospace',
                  }}
                >
                  {skillEntry.element ?? 'NONE'}
                </span>
                <span style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace' }}>
                  MP {skillEntry.mpCost ?? '—'}
                </span>
              </div>
            </div>
          )}

          {/* Power/element override */}
          <details style={{ cursor: 'pointer' }}>
            <summary
              style={{
                fontSize: 12,
                color: (manualPower !== null || manualElement !== null) ? '#c084fc' : '#7878a8',
                fontFamily: 'Space Mono, monospace',
                listStyle: 'none',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 0', userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 14 }}>{(manualPower !== null || manualElement !== null) ? '▲' : '▶'}</span>
              スキル値手動上書き{(manualPower !== null || manualElement !== null) ? '（変更中）' : ''}
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 16 }}>
              <Field label={`power（スキル値: ${skillEntry.power ?? 1.0}）`}>
                <NumField value={power} onChange={setManualPower} min={0.1} max={10} step={0.05} />
              </Field>
              <Field label="属性（スキル値から上書き）">
                <StyledSelect
                  value={element}
                  options={ELEMENTS.map((e) => ({ value: e, label: e }))}
                  onChange={(v) => setManualElement(v as ElementType)}
                />
              </Field>
              <ResetBtn
                onClick={() => { setManualPower(null); setManualElement(null); }}
                label="↺ スキル値にリセット"
              />
            </div>
          </details>
        </div>

        {/* ③ DEFENDER */}
        <div
          style={{
            background: '#111118',
            border: '1px solid rgba(139,0,255,0.2)',
            borderRadius: 12,
            padding: '22px 22px 18px',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}
        >
          <SectionTitle step="③" title="防衛側（敵）" />

          <Field label="対象敵">
            <StyledSelect
              value={enemyId}
              options={enemyOptions}
              onChange={(v) => { setEnemyId(v); setUseCustomDef(false); }}
            />
          </Field>

          {/* Enemy info card */}
          {!useCustomDef && (
            <div
              style={{
                background: '#0a0a12',
                border: '1px solid rgba(139,0,255,0.15)',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: 10,
              }}
            >
              {[
                { label: 'HP', value: enemyEntry.stats?.hp ?? '—' },
                { label: 'ATK', value: enemyEntry.stats?.atk ?? '—' },
                { label: 'DEF', value: enemyEntry.stats?.def ?? '—' },
                { label: 'SPD', value: enemyEntry.stats?.spd ?? '—' },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#7878a8', fontFamily: 'Space Mono, monospace' }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#e0d0ff', fontFamily: 'Space Mono, monospace' }}>{String(s.value)}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid rgba(139,0,255,0.1)' }}>
                <span
                  style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 6,
                    background: `${tierColor}20`, border: `1px solid ${tierColor}50`,
                    color: tierColor, fontFamily: 'Space Mono, monospace',
                  }}
                >
                  {enemyEntry.tier ?? '?'}
                </span>
                <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 6,
                  background: 'rgba(200,180,248,0.1)', border: '1px solid rgba(200,180,248,0.25)',
                  color: '#c8b4f8', fontFamily: 'Space Mono, monospace',
                }}>
                  {enemyEntry.tribe ?? '?'}
                </span>
                <span
                  style={{
                    fontSize: 11, padding: '2px 10px', borderRadius: 6, marginLeft: 'auto',
                    background: autoResistance < 0 ? 'rgba(248,113,113,0.12)' : autoResistance > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(120,120,168,0.1)',
                    border: `1px solid ${autoResistance < 0 ? 'rgba(248,113,113,0.4)' : autoResistance > 0 ? 'rgba(74,222,128,0.3)' : 'rgba(120,120,168,0.2)'}`,
                    color: autoResistance < 0 ? '#f87171' : autoResistance > 0 ? '#4ade80' : '#7878a8',
                    fontFamily: 'Space Mono, monospace', fontWeight: autoResistance !== 0 ? 700 : 400,
                  }}
                >
                  {element} {autoResistance > 0 ? `+${autoResistance}%` : `${autoResistance}%`}
                </span>
              </div>
            </div>
          )}

          {/* Custom toggle */}
          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              cursor: 'pointer',
              padding: '10px 14px',
              background: useCustomDef ? 'rgba(139,0,255,0.1)' : 'transparent',
              border: `1px solid ${useCustomDef ? 'rgba(139,0,255,0.35)' : 'rgba(139,0,255,0.15)'}`,
              borderRadius: 8,
              transition: 'all 0.15s ease',
            }}
          >
            <input
              type="checkbox"
              checked={useCustomDef}
              onChange={(e) => setUseCustomDef(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#8B00FF', cursor: 'pointer', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: useCustomDef ? '#d0b8f0' : '#9090b0', fontFamily: 'Space Mono, monospace' }}>
              カスタム DEF / 耐性値を使用
            </span>
          </label>

          {useCustomDef && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="DEF（カスタム値）">
                <NumField value={customDef} onChange={setCustomDef} min={0} />
              </Field>
              <Field label="属性耐性 %（マイナス = 弱点）" hint="例: LIGHT vs UNDEAD → -30%">
                <NumField value={customResistance} onChange={setCustomResistance} min={-100} max={100} />
              </Field>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Results ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'sticky', top: 64,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {/* Result header */}
        <div>
          <div style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            計算結果
          </div>

          {/* Damage cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <DmgCard
              label="通常ダメージ"
              value={result.normal}
              color="#60a5fa"
              barPct={(result.normal / result.critical) * 100}
            />
            <DmgCard
              label="クリティカル"
              value={result.critical}
              color="#f87171"
              barPct={100}
            />
          </div>
          <div
            style={{
              background: '#111118',
              border: '2px solid rgba(192,132,252,0.4)',
              borderRadius: 12,
              padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#9090b0', fontFamily: 'Space Mono, monospace', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                期待値
              </div>
              <div style={{ fontSize: 14, color: '#666688', fontFamily: 'Space Mono, monospace' }}>
                通常 × {((1 - critRateFrac) * 100).toFixed(1)}% + クリ × {(critRateFrac * 100).toFixed(1)}%
              </div>
            </div>
            <div style={{ fontSize: 64, fontWeight: 700, color: '#c084fc', fontFamily: 'Space Mono, monospace', lineHeight: 1 }}>
              {result.expected}
            </div>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13,
              background: `${elemColor}18`, border: `1px solid ${elemColor}50`,
              color: elemColor, fontFamily: 'Space Mono, monospace',
            }}
          >
            {element}
          </span>
          {result.isWeakness && (
            <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13,
              background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)',
              color: '#f87171', fontFamily: 'Space Mono, monospace', fontWeight: 700,
            }}>
              ⚡ 弱点属性
            </span>
          )}
          {result.isResisted && (
            <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13,
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80', fontFamily: 'Space Mono, monospace',
            }}>
              耐性あり
            </span>
          )}
        </div>

        {/* Formula chain */}
        <div
          style={{
            background: '#0d0d14',
            border: '1px solid rgba(139,0,255,0.18)',
            borderRadius: 12,
            padding: '20px 20px',
          }}
        >
          <div style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
            計算チェーン
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
            <FormulaStep label="ATK × power" value={result.baseDmg.toFixed(1)} />
            <Arrow />
            <FormulaStep
              label={`DEF軽減（${def}）`}
              value={`×${(result.defMult * 100).toFixed(1)}%`}
              highlight={result.defMult < 0.99}
            />
            <Arrow />
            <FormulaStep
              label={`属性加成（+${elementBoostPct}%）`}
              value={`×${(result.elemMult * 100).toFixed(0)}%`}
              highlight={elementBoostPct > 0}
            />
            <Arrow />
            <FormulaStep
              label={`耐性（${resistance}%）`}
              value={`×${(result.resistMult * 100).toFixed(0)}%`}
              highlight={resistance !== 0}
            />
            <Arrow />
            <FormulaStep label="通常" value={String(result.normal)} highlight />
          </div>
        </div>

        {/* Breakdown grid */}
        <div
          style={{
            background: '#0d0d14',
            border: '1px solid rgba(139,0,255,0.18)',
            borderRadius: 12,
            padding: '20px 20px',
          }}
        >
          <div style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
            パラメータ確認
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'ATK', value: String(atk), sub: isAtkOverridden ? '手動' : '自動' },
              { label: 'power', value: String(power), sub: manualPower !== null ? '手動' : 'スキル' },
              { label: '会心率', value: `${critRate}%`, sub: manualCritRate !== null ? '手動' : '自動' },
              { label: '会心倍率', value: `${critDmg}%`, sub: manualCritDmg !== null ? '手動' : '自動' },
              { label: '敵 DEF', value: String(def), sub: useCustomDef ? 'カスタム' : '敵データ' },
              { label: '耐性', value: `${resistance}%`, sub: useCustomDef ? 'カスタム' : '敵データ' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: '#111118',
                  border: '1px solid rgba(139,0,255,0.1)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace' }}>{item.label}</div>
                  <div style={{ fontSize: 9, color: '#444460', fontFamily: 'Space Mono, monospace', marginTop: 1 }}>{item.sub}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#d0c0f0', fontFamily: 'Space Mono, monospace' }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
