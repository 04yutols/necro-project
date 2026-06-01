'use client';

import { useState, useMemo } from 'react';
import { calculateBattleDamage } from '@/logic/BattleDamage';
import { calculateJobAdjustedStats } from '@/logic/JobSystem';
import { INITIAL_PLAYER_BASE_STATS } from '@/logic/BalanceConfig';
import type { ElementType, BaseStats } from '@/types/game';

// ── Minimal shapes from master data ──────────────────────────────────────────

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
};

type EnemyEntry = {
  nameJa?: string;
  tier?: string;
  tribe?: string;
  stats?: Partial<BaseStats>;
  resistances?: Record<string, number>;
};

type SimResult = {
  normal: number;
  critical: number;
  expected: number;
  baseDmg: number;
  defMultPct: number;
  elemMultPct: number;
  resistPct: number;
  isWeakness: boolean;
  isResisted: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const ELEMENTS: ElementType[] = [
  'NONE', 'FIRE', 'WATER', 'THUNDER', 'EARTH', 'WIND', 'ICE', 'LIGHT', 'DARK',
];

const ELEM_COLOR: Record<string, string> = {
  FIRE: '#f87171', WATER: '#60a5fa', THUNDER: '#fbbf24', EARTH: '#a78bfa',
  WIND: '#4ade80', ICE: '#67e8f9', LIGHT: '#fde68a', DARK: '#c084fc', NONE: '#7878a8',
};

function computePassiveAtk(jobEntry: JobEntry, level: number): number {
  let bonus = 0;
  if (!jobEntry.levelBonuses) return 0;
  for (let lv = 1; lv <= level; lv++) {
    const b = jobEntry.levelBonuses[lv.toString()];
    if (b?.passiveAtkBonus) bonus += b.passiveAtkBonus as number;
  }
  return bonus;
}

function computeBaseAtk(jobEntry: JobEntry, level: number): number {
  const jobData = {
    statModifiers: jobEntry.statModifiers ?? {},
    levelBonuses: jobEntry.levelBonuses ?? {},
  };
  const jobStats = calculateJobAdjustedStats(INITIAL_PLAYER_BASE_STATS, jobData as Parameters<typeof calculateJobAdjustedStats>[1]);
  return jobStats.atk + computePassiveAtk(jobEntry, level);
}

function computeBaseCritRate(jobEntry: JobEntry): number {
  const jobData = { statModifiers: jobEntry.statModifiers ?? {} };
  const jobStats = calculateJobAdjustedStats(INITIAL_PLAYER_BASE_STATS, jobData as Parameters<typeof calculateJobAdjustedStats>[1]);
  return jobStats.critRate;
}

function computeBaseCritDmg(jobEntry: JobEntry): number {
  const jobData = { statModifiers: jobEntry.statModifiers ?? {} };
  const jobStats = calculateJobAdjustedStats(INITIAL_PLAYER_BASE_STATS, jobData as Parameters<typeof calculateJobAdjustedStats>[1]);
  return jobStats.critDmg;
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
): SimResult {
  const attackerStats: BaseStats = {
    ...INITIAL_PLAYER_BASE_STATS,
    atk,
    critRate,
    critDmg,
  };
  const defenderStats: BaseStats = { ...INITIAL_PLAYER_BASE_STATS, def };
  const defenderResistances: Record<string, number> = { [element]: resistance };
  const attackerElementBoosts: Partial<Record<ElementType, number>> = {
    [element]: elementBoostPct,
  };

  const normalResult = calculateBattleDamage({
    attackerStats,
    attackerElementBoosts,
    defenderStats,
    defenderResistances,
    powerMultiplier: power,
    element,
    rng: () => 1,
  });

  const critResult = calculateBattleDamage({
    attackerStats,
    attackerElementBoosts,
    defenderStats,
    defenderResistances,
    powerMultiplier: power,
    element,
    rng: () => 0,
  });

  const critRateFrac = Math.min(100, Math.max(0, critRate)) / 100;
  const expected = Math.round(
    normalResult.damage * (1 - critRateFrac) + critResult.damage * critRateFrac,
  );

  // breakdown
  const baseDmg = atk * power;
  const rawDef = Math.max(0, def);
  const defMultPct = (1 - rawDef / (rawDef + 200)) * 100;
  const elemMultPct = (1 + elementBoostPct / 100) * 100;
  const resistPct = (1 - resistance / 100) * 100;

  return {
    normal: normalResult.damage,
    critical: critResult.damage,
    expected,
    baseDmg,
    defMultPct,
    elemMultPct,
    resistPct,
    isWeakness: resistance < 0,
    isResisted: resistance > 0,
  };
}

// ── Input components ──────────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, color: '#7878a8', fontFamily: 'Space Mono, monospace' }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          padding: '5px 8px',
          background: '#0d0d14',
          border: '1px solid rgba(139,0,255,0.25)',
          borderRadius: 6,
          color: '#e0d0ff',
          fontSize: 13,
          fontFamily: 'Space Mono, monospace',
          outline: 'none',
        }}
      />
    </div>
  );
}

function SelectInput<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, color: '#7878a8', fontFamily: 'Space Mono, monospace' }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          width: '100%',
          padding: '5px 8px',
          background: '#0d0d14',
          border: '1px solid rgba(139,0,255,0.25)',
          borderRadius: 6,
          color: '#e0d0ff',
          fontSize: 12,
          fontFamily: 'Space Mono, monospace',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#111118',
        border: '1px solid rgba(139,0,255,0.18)',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: 'Space Mono, monospace',
          color: '#8B00FF',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(139,0,255,0.15)',
          paddingBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Result bar ────────────────────────────────────────────────────────────────

function ResultBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          fontFamily: 'Space Mono, monospace',
          color: '#a0a0c0',
        }}
      >
        <span>{label}</span>
        <span style={{ color, fontWeight: 700, fontSize: 18 }}>{value}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 3,
            transition: 'width 0.25s ease',
          }}
        />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

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

  // ── Attacker state ──
  const [jobId, setJobId] = useState<string>(jobIds[0] ?? 'warrior');
  const [level, setLevel] = useState(1);
  const [manualAtk, setManualAtk] = useState<number | null>(null);
  const [manualCritRate, setManualCritRate] = useState<number | null>(null);
  const [manualCritDmg, setManualCritDmg] = useState<number | null>(null);
  const [elementBoostPct, setElementBoostPct] = useState(0);

  // ── Skill state ──
  const [skillId, setSkillId] = useState<string>('');
  const [manualPower, setManualPower] = useState<number | null>(null);
  const [manualElement, setManualElement] = useState<ElementType | null>(null);

  // ── Defender state ──
  const [enemyId, setEnemyId] = useState<string>(enemyIds[0] ?? 'grave_soldier');
  const [useCustomDef, setUseCustomDef] = useState(false);
  const [customDef, setCustomDef] = useState(5);
  const [customResistance, setCustomResistance] = useState(0);

  // ── Derived ──
  const jobEntry = jobs[jobId] ?? ({} as JobEntry);

  const jobSkillIds = useMemo(() => {
    return (jobEntry.skills ?? []).map((s) => s.skillId);
  }, [jobEntry]);

  const resolvedSkillId = useMemo(() => {
    if (skillId && jobSkillIds.includes(skillId)) return skillId;
    return jobSkillIds[0] ?? '';
  }, [skillId, jobSkillIds]);

  const skillEntry = skills[resolvedSkillId] ?? ({} as SkillEntry);

  const autoAtk = useMemo(() => computeBaseAtk(jobEntry, level), [jobEntry, level]);
  const autoCritRate = useMemo(() => computeBaseCritRate(jobEntry), [jobEntry]);
  const autoCritDmg = useMemo(() => computeBaseCritDmg(jobEntry), [jobEntry]);

  const atk = manualAtk !== null ? manualAtk : autoAtk;
  const critRate = manualCritRate !== null ? manualCritRate : autoCritRate;
  const critDmg = manualCritDmg !== null ? manualCritDmg : autoCritDmg;
  const power = manualPower !== null ? manualPower : (skillEntry.power ?? 1.0);
  const element: ElementType =
    manualElement !== null ? manualElement : ((skillEntry.element ?? 'NONE') as ElementType);

  const enemyEntry = enemies[enemyId] ?? ({} as EnemyEntry);
  const def = useCustomDef ? customDef : (enemyEntry.stats?.def ?? 5);
  const autoResistance = (enemyEntry.resistances ?? {})[element] ?? 0;
  const resistance = useCustomDef ? customResistance : autoResistance;

  const result = useMemo(
    () => simulate(atk, critRate, critDmg, elementBoostPct, def, resistance, power, element),
    [atk, critRate, critDmg, elementBoostPct, def, resistance, power, element],
  );

  const barMax = result.critical;

  // ── Job options ──
  const jobOptions = jobIds.map((id) => ({
    value: id,
    label: `${jobs[id].displayName ?? id} (${id})`,
  }));

  // ── Skill options from current job ──
  const skillOptions = jobSkillIds
    .filter((id) => skills[id])
    .map((id) => ({
      value: id,
      label: `${skills[id].name ?? id}  ×${skills[id].power ?? 1.0}`,
    }));

  // ── Enemy options ──
  const enemyOptions = enemyIds.map((id) => ({
    value: id,
    label: `[${enemies[id].tier ?? '?'}] ${enemies[id].nameJa ?? id}`,
  }));

  const elemColor = ELEM_COLOR[element] ?? '#7878a8';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="font-cinzel text-xl font-bold tracking-widest uppercase mb-1"
          style={{ color: '#e0d0ff', textShadow: '0 0 16px rgba(139,0,255,0.4)' }}
        >
          DAMAGE SIMULATOR
        </h1>
        <p className="text-xs font-space" style={{ color: '#7878a8' }}>
          calculateBattleDamage — マスターデータからリアルタイムダメージ計算
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Attacker Panel */}
        <Panel title="ATTACKER">
          <SelectInput
            label="職業"
            value={jobId}
            options={jobOptions}
            onChange={(v) => {
              setJobId(v);
              setManualAtk(null);
              setManualCritRate(null);
              setManualCritDmg(null);
            }}
          />
          <NumInput label="レベル (1〜30)" value={level} onChange={setLevel} min={1} max={30} />
          <NumInput
            label={`ATK (自動: ${autoAtk})`}
            value={atk}
            onChange={setManualAtk}
            min={1}
          />
          <NumInput
            label={`会心率 % (自動: ${autoCritRate})`}
            value={critRate}
            onChange={setManualCritRate}
            min={0}
            max={100}
            step={0.1}
          />
          <NumInput
            label={`会心倍率 % (自動: ${autoCritDmg})`}
            value={critDmg}
            onChange={setManualCritDmg}
            min={100}
            max={500}
            step={1}
          />
          <NumInput
            label="属性ダメージ加成 %"
            value={elementBoostPct}
            onChange={setElementBoostPct}
            min={0}
            max={200}
          />
          <button
            onClick={() => {
              setManualAtk(null);
              setManualCritRate(null);
              setManualCritDmg(null);
            }}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontFamily: 'Space Mono, monospace',
              background: 'rgba(139,0,255,0.12)',
              border: '1px solid rgba(139,0,255,0.3)',
              borderRadius: 6,
              color: '#a080d0',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            ↺ 自動値にリセット
          </button>
        </Panel>

        {/* Skill Panel */}
        <Panel title="SKILL">
          <SelectInput
            label="スキル"
            value={resolvedSkillId}
            options={skillOptions}
            onChange={(v) => {
              setSkillId(v);
              setManualPower(null);
              setManualElement(null);
            }}
          />
          {resolvedSkillId && (
            <div
              style={{
                padding: '8px 10px',
                background: '#0d0d14',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'Space Mono, monospace',
                color: '#7878a8',
                lineHeight: 1.6,
              }}
            >
              <div>
                <span style={{ color: '#a0a0c0' }}>power:</span>{' '}
                <span style={{ color: '#e0d0ff' }}>{skillEntry.power ?? '—'}</span>
              </div>
              <div>
                <span style={{ color: '#a0a0c0' }}>element:</span>{' '}
                <span style={{ color: elemColor }}>{skillEntry.element ?? 'NONE'}</span>
              </div>
              <div>
                <span style={{ color: '#a0a0c0' }}>MPcost:</span>{' '}
                <span style={{ color: '#e0d0ff' }}>{skillEntry.mpCost ?? '—'}</span>
              </div>
            </div>
          )}
          <NumInput
            label="power 上書き"
            value={power}
            onChange={setManualPower}
            min={0.1}
            max={10}
            step={0.05}
          />
          <SelectInput
            label="属性 上書き"
            value={element}
            options={ELEMENTS.map((e) => ({ value: e, label: e }))}
            onChange={(v) => setManualElement(v as ElementType)}
          />
          <button
            onClick={() => {
              setManualPower(null);
              setManualElement(null);
            }}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              fontFamily: 'Space Mono, monospace',
              background: 'rgba(139,0,255,0.12)',
              border: '1px solid rgba(139,0,255,0.3)',
              borderRadius: 6,
              color: '#a080d0',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            ↺ スキル値にリセット
          </button>
        </Panel>

        {/* Defender Panel */}
        <Panel title="DEFENDER">
          <SelectInput
            label="対象敵"
            value={enemyId}
            options={enemyOptions}
            onChange={(v) => {
              setEnemyId(v);
              setUseCustomDef(false);
            }}
          />
          {!useCustomDef && enemyEntry && (
            <div
              style={{
                padding: '8px 10px',
                background: '#0d0d14',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'Space Mono, monospace',
                color: '#7878a8',
                lineHeight: 1.6,
              }}
            >
              <div>
                <span style={{ color: '#a0a0c0' }}>DEF:</span>{' '}
                <span style={{ color: '#e0d0ff' }}>{enemyEntry.stats?.def ?? '—'}</span>
              </div>
              <div>
                <span style={{ color: '#a0a0c0' }}>HP:</span>{' '}
                <span style={{ color: '#e0d0ff' }}>{enemyEntry.stats?.hp ?? '—'}</span>
              </div>
              <div>
                <span style={{ color: '#a0a0c0' }}>族:</span>{' '}
                <span style={{ color: '#c8b4f8' }}>{enemyEntry.tribe ?? '—'}</span>
              </div>
              <div>
                <span style={{ color: '#a0a0c0' }}>{element} 耐性:</span>{' '}
                <span
                  style={{
                    color:
                      autoResistance < 0 ? '#f87171' : autoResistance > 0 ? '#4ade80' : '#7878a8',
                    fontWeight: autoResistance !== 0 ? 700 : 400,
                  }}
                >
                  {autoResistance > 0 ? '+' : ''}
                  {autoResistance}%
                </span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="useCustomDef"
              checked={useCustomDef}
              onChange={(e) => setUseCustomDef(e.target.checked)}
              style={{ accentColor: '#8B00FF', cursor: 'pointer' }}
            />
            <label
              htmlFor="useCustomDef"
              style={{ fontSize: 11, color: '#7878a8', fontFamily: 'Space Mono, monospace', cursor: 'pointer' }}
            >
              カスタム値を使用
            </label>
          </div>
          {useCustomDef && (
            <>
              <NumInput label="DEF (カスタム)" value={customDef} onChange={setCustomDef} min={0} />
              <NumInput
                label="属性耐性 % (マイナス=弱点)"
                value={customResistance}
                onChange={setCustomResistance}
                min={-100}
                max={100}
              />
            </>
          )}
        </Panel>
      </div>

      {/* Result Panel */}
      <div
        style={{
          background: '#0d0d14',
          border: '1px solid rgba(139,0,255,0.3)',
          borderRadius: 12,
          padding: '24px 28px',
        }}
      >
        {/* Result values */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 24,
            marginBottom: 24,
          }}
        >
          <ResultBar label="通常ダメージ" value={result.normal} max={barMax} color="#60a5fa" />
          <ResultBar label="クリティカル" value={result.critical} max={barMax} color="#f87171" />
          <ResultBar label="期待値" value={result.expected} max={barMax} color="#c084fc" />
        </div>

        {/* Badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {result.isWeakness && (
            <span
              style={{
                padding: '2px 10px',
                borderRadius: 12,
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid rgba(248,113,113,0.4)',
                color: '#f87171',
                fontSize: 11,
                fontFamily: 'Space Mono, monospace',
              }}
            >
              ⚡ 弱点属性
            </span>
          )}
          {result.isResisted && (
            <span
              style={{
                padding: '2px 10px',
                borderRadius: 12,
                background: 'rgba(74,222,128,0.12)',
                border: '1px solid rgba(74,222,128,0.35)',
                color: '#4ade80',
                fontSize: 11,
                fontFamily: 'Space Mono, monospace',
              }}
            >
              ⛊ 耐性あり
            </span>
          )}
          <span
            style={{
              padding: '2px 10px',
              borderRadius: 12,
              background: `${elemColor}18`,
              border: `1px solid ${elemColor}50`,
              color: elemColor,
              fontSize: 11,
              fontFamily: 'Space Mono, monospace',
            }}
          >
            {element}
          </span>
        </div>

        {/* Breakdown */}
        <div
          style={{
            borderTop: '1px solid rgba(139,0,255,0.12)',
            paddingTop: 16,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: '#7878a8',
              fontFamily: 'Space Mono, monospace',
              letterSpacing: '0.1em',
              marginBottom: 10,
              textTransform: 'uppercase',
            }}
          >
            計算ブレークダウン
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
            }}
          >
            {[
              { label: 'baseDmg', value: result.baseDmg.toFixed(1), sub: `ATK ${atk} × power ${power}` },
              { label: 'defMult', value: `${result.defMultPct.toFixed(1)}%`, sub: `DEF ${def} / (${def}+200)` },
              { label: 'elemMult', value: `${result.elemMultPct.toFixed(1)}%`, sub: `+${elementBoostPct}% boost` },
              { label: 'resistMult', value: `${result.resistPct.toFixed(1)}%`, sub: `resistance ${resistance}%` },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background: '#111118',
                  border: '1px solid rgba(139,0,255,0.12)',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: '#7878a8',
                    fontFamily: 'Space Mono, monospace',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{ fontSize: 18, fontFamily: 'Space Mono, monospace', color: '#e0d0ff', fontWeight: 700 }}
                >
                  {item.value}
                </div>
                <div style={{ fontSize: 9, color: '#555570', fontFamily: 'Space Mono, monospace', marginTop: 2 }}>
                  {item.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
