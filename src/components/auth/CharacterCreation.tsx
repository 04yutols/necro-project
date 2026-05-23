'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import jobsData from '../../data/master/jobs.json';
import skillsData from '../../data/master/skills.json';
import { getJobStyle } from '../../logic/JobSystem';
import { useGameStore } from '../../store/useGameStore';
import type { BaseStats, JobData, SkillData } from '../../types/game';

interface CharacterCreationProps {
  initialName?: string | null;
  onCreated: () => void;
}

const STARTER_JOB_IDS = ['warrior', 'mage', 'dark_priest', 'rogue'] as const;
const SKILLS = skillsData as Record<string, SkillData>;
const STAT_LABELS: Partial<Record<keyof BaseStats, string>> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  critRate: 'CRIT',
  critDmg: 'C.DMG',
  effectHit: 'E.HIT',
  effectRes: 'E.RES',
};

function deriveInitialName(initialName?: string | null) {
  const candidate = (initialName ?? '').includes('@')
    ? (initialName ?? '').split('@')[0]
    : initialName;
  const trimmed = candidate?.trim() || 'アルド';
  return trimmed.slice(0, 16);
}

function getPrimarySkill(job: JobData) {
  const firstSkill = job.skills.find((skill) => skill.level === 1) ?? job.skills[0];
  return firstSkill ? SKILLS[firstSkill.skillId] : null;
}

function getStatTendency(job: JobData) {
  const modifiers = job.statModifiers ?? {};
  return Object.entries(modifiers)
    .sort(([, a], [, b]) => (b ?? 1) - (a ?? 1))
    .slice(0, 3)
    .map(([key, value]) => `${STAT_LABELS[key as keyof BaseStats] ?? key.toUpperCase()} ${Math.round((value ?? 1) * 100)}%`)
    .join(' / ');
}

export function CharacterCreation({ initialName, onCreated }: CharacterCreationProps) {
  const defaultName = useMemo(() => deriveInitialName(initialName), [initialName]);
  const [name, setName] = useState(defaultName);
  const [nameTouched, setNameTouched] = useState(false);
  const [jobId, setJobId] = useState<(typeof STARTER_JOB_IDS)[number]>('warrior');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const loadFromServer = useGameStore((state) => state.loadFromServer);

  const jobs = useMemo(() => {
    const source = jobsData as Record<string, JobData>;
    return STARTER_JOB_IDS.map((id) => ({ id, data: source[id], style: getJobStyle(id) }));
  }, []);
  const selected = jobs.find((job) => job.id === jobId) ?? jobs[0];
  const selectedSkill = getPrimarySkill(selected.data);
  const selectedTendency = getStatTendency(selected.data);

  useEffect(() => {
    if (!nameTouched) setName(defaultName);
  }, [defaultName, nameTouched]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { createCharacterAction } = await import('../../app/actions');
      const result = await createCharacterAction(jobId, name);
      if (!result.success) throw new Error(result.error);
      loadFromServer(result.data);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'キャラクター作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="h-[100dvh] w-full overflow-hidden"
      style={{
        background: `radial-gradient(circle at 50% 0%, ${selected.style.glow}, transparent 48%), #050505`,
        color: '#F0EAFF',
      }}
    >
      <div
        className="h-full min-h-0 overflow-y-auto safe-scroll"
        style={{
          padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 16px calc(env(safe-area-inset-bottom, 0px) + 18px)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <form onSubmit={handleSubmit} style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560, margin: '0 auto' }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              display: 'grid',
              placeItems: 'center',
              border: `1px solid ${selected.style.color}66`,
              background: selected.style.soft,
              color: selected.style.color,
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 20, fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1.1 }}>
                魂を宿す職業を選べ
              </div>
              <div style={{ color: 'rgba(220,210,240,0.62)', fontSize: 11, marginTop: 4 }}>
                初回のみ作成・名前は変更可能
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              borderRadius: 20,
              border: `1px solid ${selected.style.color}55`,
              background: 'linear-gradient(180deg, rgba(12,6,28,0.94), rgba(4,2,12,0.98))',
              boxShadow: `0 24px 70px rgba(0,0,0,0.72), 0 0 34px ${selected.style.glow}`,
              padding: 18,
            }}
          >
            <label style={{ display: 'grid', gap: 8, marginBottom: 15 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#8b7da8', letterSpacing: '0.16em', fontFamily: "'Cinzel', serif" }}>NAME</span>
              <input
                value={name}
                onChange={(event) => {
                  setNameTouched(true);
                  setName(event.target.value);
                }}
                minLength={2}
                maxLength={16}
                required
                style={{
                  width: '100%',
                  minHeight: 48,
                  borderRadius: 13,
                  border: `1px solid ${selected.style.color}44`,
                  background: 'rgba(0,0,0,0.34)',
                  color: '#F0EAFF',
                  outline: 'none',
                  padding: '0 13px',
                  fontSize: 16,
                  fontWeight: 800,
                }}
              />
            </label>

            <div style={{ display: 'grid', gap: 10 }}>
              {jobs.map((job) => {
                const active = job.id === jobId;
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => setJobId(job.id)}
                    style={{
                      minHeight: 74,
                      borderRadius: 15,
                      border: active ? `1px solid ${job.style.color}AA` : '1px solid rgba(255,255,255,0.08)',
                      background: active ? `linear-gradient(135deg, ${job.style.soft}, rgba(255,255,255,0.035))` : 'rgba(255,255,255,0.035)',
                      color: '#F0EAFF',
                      display: 'grid',
                      gridTemplateColumns: '46px minmax(0,1fr) 24px',
                      alignItems: 'center',
                      gap: 12,
                      textAlign: 'left',
                      padding: '10px 12px',
                      boxShadow: active ? `0 0 20px ${job.style.glow}` : 'none',
                    }}
                  >
                    <span style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      display: 'grid',
                      placeItems: 'center',
                      border: `1px solid ${job.style.color}55`,
                      background: job.style.soft,
                      color: job.style.color,
                      fontFamily: "'Cinzel Decorative', serif",
                      fontWeight: 900,
                    }}>
                      {job.data.nameEn?.slice(0, 1) ?? job.id.slice(0, 1).toUpperCase()}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 900, color: '#F0EAFF' }}>
                        {job.data.displayName ?? job.data.name}
                      </span>
                      <span style={{ display: 'block', marginTop: 3, fontSize: 10, lineHeight: 1.5, color: 'rgba(220,210,240,0.62)' }}>
                        {job.data.role}
                      </span>
                      <span style={{ display: 'block', marginTop: 4, fontSize: 10, lineHeight: 1.5, color: active ? job.style.color : 'rgba(212,175,55,0.55)' }}>
                        {getPrimarySkill(job.data)?.name ?? '初期術式'} / {getStatTendency(job.data)}
                      </span>
                    </span>
                    <ChevronRight size={18} color={active ? job.style.color : '#4a3a5a'} />
                  </button>
                );
              })}
            </div>

            {error && (
              <div style={{
                marginTop: 14,
                borderRadius: 12,
                border: '1px solid rgba(139,0,0,0.34)',
                background: 'rgba(139,0,0,0.14)',
                color: '#FFB4B4',
                padding: '10px 12px',
                fontSize: 12,
              }}>
                {error}
              </div>
            )}

            <div style={{
              marginTop: 14,
              borderRadius: 14,
              border: `1px solid ${selected.style.color}33`,
              background: 'rgba(0,0,0,0.24)',
              padding: '12px 13px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', color: selected.style.color, fontFamily: "'Cinzel', serif" }}>SELECTED CLASS</div>
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7, color: 'rgba(240,234,255,0.84)' }}>
                {selected.data.description}
              </div>
              <div style={{ marginTop: 8, display: 'grid', gap: 4, color: 'rgba(220,210,240,0.68)', fontSize: 11, lineHeight: 1.5 }}>
                <span>代表スキル: {selectedSkill?.name ?? '初期術式'} {selectedSkill ? ` / ${selectedSkill.description}` : ''}</span>
                <span>ステータス傾向: {selectedTendency}</span>
              </div>
            </div>
          </motion.div>

          <div style={{ marginTop: 'auto' }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                minHeight: 52,
                borderRadius: 16,
                border: `1px solid ${selected.style.color}99`,
                background: submitting ? 'rgba(139,0,255,0.12)' : `linear-gradient(135deg, ${selected.style.color}55, rgba(139,0,255,0.18))`,
                color: '#F0EAFF',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '0.16em',
                boxShadow: submitting ? 'none' : `0 0 20px ${selected.style.glow}`,
                opacity: submitting ? 0.65 : 1,
              }}
            >
              {submitting ? '契約中' : '冒険開始'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
