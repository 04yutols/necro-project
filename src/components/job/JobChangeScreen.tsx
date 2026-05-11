'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Lock, Sparkles, Swords, Wand2 } from 'lucide-react';
import jobsData from '../../data/master/jobs.json';
import skillsData from '../../data/master/skills.json';
import { addPassiveBonuses, calculateJobAdjustedStats, getJobLevel, getJobStyle, getJobUnlockStatus, JOB_ORDER, resolveJobSkills, STAT_KEYS } from '../../logic/JobSystem';
import { useGameStore } from '../../store/useGameStore';
import type { BaseStats, JobData, SkillAttackType, SkillData } from '../../types/game';

const JOBS = jobsData as Record<string, JobData>;
const SKILLS = skillsData as Record<string, SkillData>;

const STAT_LABEL: Record<keyof BaseStats, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  critRate: 'CRIT%',
  critDmg: 'CRIT DMG',
  effectHit: 'EFF HIT',
  effectRes: 'EFF RES',
};

const ATTACK_LABEL: Record<SkillAttackType, string> = {
  SLASH: '斬撃',
  STRIKE: '衝撃',
  PROJECTILE: '射出',
  MAGIC: '魔法',
  SUMMON: '召喚',
  HEAL: '回復',
};

const ELEMENT_LABEL: Record<string, string> = {
  FIRE: '炎',
  WATER: '水',
  THUNDER: '雷',
  EARTH: '土',
  WIND: '風',
  ICE: '氷',
  LIGHT: '光',
  DARK: '闇',
  NONE: '無',
};

function formatJobRequirement(jobId: string, minLevel: number) {
  const job = JOBS[jobId];
  return `${job?.displayName ?? job?.name ?? jobId} Lv.${minLevel}`;
}

function JobSigil({ jobId, size = 140 }: { jobId: string; size?: number }) {
  const style = getJobStyle(jobId);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 50% 42%, ${style.soft}, rgba(8,2,18,0.9) 56%, rgba(0,0,0,0.94))`,
        border: `1px solid ${style.color}88`,
        boxShadow: `0 0 36px ${style.glow}, inset 0 0 38px rgba(255,255,255,0.04)`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 14,
          borderRadius: '50%',
          border: `1px dashed ${style.color}70`,
          animation: 'jobSigilSpin 11s linear infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 34,
          borderRadius: '18%',
          border: `1px solid ${style.color}55`,
          transform: 'rotate(45deg)',
          boxShadow: `0 0 18px ${style.glow}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '80%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${style.color}, transparent)`,
          transform: 'rotate(-28deg)',
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '76%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${style.color}, transparent)`,
          transform: 'rotate(28deg)',
          opacity: 0.45,
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: "'Cinzel Decorative', serif",
          fontSize: size * 0.26,
          color: '#F0EAFF',
          textShadow: `0 0 18px ${style.color}, 0 0 34px ${style.glow}`,
          lineHeight: 1,
        }}
      >
        {style.emoji}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 28,
          fontFamily: 'monospace',
          fontSize: 8,
          letterSpacing: '0.18em',
          color: style.color,
          textShadow: `0 0 10px ${style.glow}`,
        }}
      >
        {style.motif}
      </div>
    </div>
  );
}

export default function JobChangeScreen() {
  const { player, changeJob, setCurrentTab } = useGameStore();
  const [selectedJobId, setSelectedJobId] = useState(player?.currentJobId ?? 'warrior');

  const jobs = useMemo(() => (
    JOB_ORDER
      .filter((jobId) => JOBS[jobId])
      .map((jobId) => ({ id: jobId, data: { ...JOBS[jobId], id: jobId } }))
  ), []);

  if (!player) return null;

  const selectedJob = JOBS[selectedJobId] ?? JOBS.warrior;
  const currentJob = JOBS[player.currentJobId] ?? JOBS.warrior;
  const selectedStyle = getJobStyle(selectedJobId);
  const currentStyle = getJobStyle(player.currentJobId);
  const selectedLevel = getJobLevel(player, selectedJobId);
  const effectiveSelectedLevel = selectedLevel || 1;
  const unlock = getJobUnlockStatus(player, selectedJob);
  const isCurrent = player.currentJobId === selectedJobId;
  const baseStats = player.baseStats ?? player.stats;
  const currentStats = addPassiveBonuses(calculateJobAdjustedStats(baseStats, currentJob), player);
  const previewStats = addPassiveBonuses(calculateJobAdjustedStats(baseStats, selectedJob), player);
  const skillEntries = resolveJobSkills(selectedJob, unlock.unlocked ? effectiveSelectedLevel : 0, SKILLS);
  const tierLabel = selectedJob.tier === 1 ? 'TIER I' : 'TIER II';

  return (
    <motion.div
      className="job-change-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: '100vw', overflow: 'hidden' }}
    >
      <div
        className="absolute inset-0 flex flex-col overflow-hidden job-change-screen__shell"
        style={{
          width: '100%',
          height: '100%',
          minWidth: 0,
          background: '#050505',
          color: '#A5A9B4',
          fontFamily: "'Noto Sans JP', system-ui, sans-serif",
          overscrollBehavior: 'none',
        }}
      >
        <div
          className="shrink-0"
          style={{
            padding: 'max(12px, env(safe-area-inset-top, 12px)) 14px 10px',
            borderBottom: '1px solid rgba(139,0,255,0.16)',
            background: 'linear-gradient(180deg, rgba(8,2,20,0.96), rgba(5,5,5,0.88))',
            boxSizing: 'border-box',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <button
              type="button"
              onClick={() => setCurrentTab('HOME')}
              aria-label="拠点へ戻る"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#8b7da8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <div style={{ minWidth: 0, textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 8, color: '#8B00FF', letterSpacing: '0.18em' }}>
                UMBRAL RITE-HALL
              </div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 18, color: '#F0EAFF', fontWeight: 800, letterSpacing: '0.06em' }}>
                転職
              </div>
            </div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: `1px solid ${currentStyle.color}55`,
                color: currentStyle.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: currentStyle.soft,
                boxShadow: `0 0 14px ${currentStyle.glow}`,
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} />
            </div>
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto custom-scrollbar safe-scroll job-change-screen__body"
          style={{
            width: '100%',
            minWidth: 0,
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          <div
            className="job-change-screen__content"
            style={{
              width: '100%',
              maxWidth: 760,
              minWidth: 0,
              boxSizing: 'border-box',
              margin: '0 auto',
              overflowX: 'hidden',
              padding: '12px max(10px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 14px) max(10px, env(safe-area-inset-left, 0px))',
            }}
          >
            <section
              style={{
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                borderRadius: 18,
                border: `1px solid ${selectedStyle.color}44`,
                background: `radial-gradient(circle at 50% 0%, ${selectedStyle.soft}, transparent 38%), linear-gradient(180deg, rgba(12,5,25,0.94), rgba(5,3,12,0.98))`,
                boxShadow: `0 18px 44px rgba(0,0,0,0.72), 0 0 30px ${selectedStyle.glow}`,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `linear-gradient(90deg, transparent, ${selectedStyle.color}0f, transparent)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 4s infinite',
                  pointerEvents: 'none',
                }}
              />
              <div className="job-change-screen__hero" style={{ position: 'relative', zIndex: 1, padding: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, minWidth: 0 }}>
                <div className="job-sigil-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 152, minWidth: 0 }}>
                  <motion.div
                    key={selectedJobId}
                    initial={{ opacity: 0, scale: 0.92, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  >
                    <JobSigil jobId={selectedJobId} />
                  </motion.div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: selectedStyle.color, letterSpacing: '0.18em' }}>{tierLabel}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#6b5f7a', letterSpacing: '0.14em' }}>{selectedJob.category}</span>
                    {!unlock.unlocked && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 9, color: '#D4AF37' }}>
                        <Lock size={11} /> LOCK
                      </span>
                    )}
                  </div>
                  <h2 className="job-change-screen__title" style={{ margin: 0, fontFamily: "'Cinzel Decorative', serif", fontSize: 24, color: '#F0EAFF', letterSpacing: '0.04em', lineHeight: 1.05, overflowWrap: 'anywhere' }}>
                    {selectedJob.displayName ?? selectedJob.name}
                  </h2>
                  <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, color: selectedStyle.color, letterSpacing: '0.12em', marginTop: 4, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
                    {selectedJob.nameEn ?? selectedJob.name} / {selectedJob.title}
                  </div>
                  <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.7, color: '#B9AEC8' }}>
                    {selectedJob.description}
                  </p>
                </div>
              </div>
            </section>

            <section style={{ marginTop: 12, width: '100%', minWidth: 0, overflow: 'hidden' }}>
              <div
                id="tut-job-rail"
                className="safe-scroll job-rail-scroll"
                style={{
                  display: 'flex',
                  gap: 8,
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  paddingBottom: 3,
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehaviorX: 'contain',
                }}
              >
                {jobs.map(({ id, data }) => {
                  const style = getJobStyle(id);
                  const level = getJobLevel(player, id);
                  const jobUnlock = getJobUnlockStatus(player, data);
                  const active = id === selectedJobId;
                  return (
                    <button
                      key={id}
                      className="job-rail-card"
                      type="button"
                      onClick={() => setSelectedJobId(id)}
                      style={{
                        flex: '0 0 clamp(84px, 23vw, 100px)',
                        width: 'clamp(84px, 23vw, 100px)',
                        minHeight: 76,
                        borderRadius: 12,
                        border: `1px solid ${active ? style.color : jobUnlock.unlocked ? style.color + '45' : 'rgba(255,255,255,0.08)'}`,
                        background: active
                          ? `linear-gradient(180deg, ${style.soft}, rgba(8,3,18,0.94))`
                          : 'rgba(255,255,255,0.035)',
                        boxShadow: active ? `0 0 18px ${style.glow}` : 'none',
                        color: active ? '#F0EAFF' : '#A5A9B4',
                        textAlign: 'left',
                        padding: '9px 9px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: jobUnlock.unlocked ? 1 : 0.56,
                        boxSizing: 'border-box',
                        minWidth: 0,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                        <span style={{ fontSize: 15, color: style.color }}>{style.emoji}</span>
                        {!jobUnlock.unlocked && <Lock size={12} color="#8A6D1F" />}
                      </span>
                      <span>
                        <span style={{ display: 'block', fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 800, lineHeight: 1.12, overflowWrap: 'anywhere' }}>{data.displayName}</span>
                        <span style={{ display: 'block', marginTop: 4, fontFamily: 'monospace', fontSize: 8, color: style.color }}>
                          {level ? `Lv.${level}` : jobUnlock.unlocked ? 'NEW' : `T${data.tier}`}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section id="tut-stat-change" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <div
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  borderRadius: 14,
                  border: '1px solid rgba(139,0,255,0.24)',
                  background: 'rgba(10,5,26,0.76)',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Swords size={15} color={selectedStyle.color} />
                  <h3 style={{ margin: 0, fontFamily: "'Cinzel', serif", fontSize: 12, color: '#F0EAFF', letterSpacing: '0.08em' }}>
                    ステータス変化
                  </h3>
                </div>
                <div className="job-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 7, width: '100%', minWidth: 0 }}>
                  {STAT_KEYS.map((key) => {
                    const current = currentStats[key];
                    const next = previewStats[key];
                    const diff = next - current;
                    return (
                      <div
                        key={key}
                        style={{
                          minHeight: 58,
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.035)',
                          border: `1px solid ${diff > 0 ? 'rgba(34,197,94,0.24)' : diff < 0 ? 'rgba(239,68,68,0.24)' : 'rgba(255,255,255,0.07)'}`,
                          padding: '7px 7px',
                          minWidth: 0,
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#6b5f7a' }}>{STAT_LABEL[key]}</div>
                        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 13, color: '#F0EAFF', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{next}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 8, color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#4a3a5a', fontVariantNumeric: 'tabular-nums' }}>
                          {diff > 0 ? `+${diff}` : diff}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  width: '100%',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  borderRadius: 14,
                  border: '1px solid rgba(139,0,255,0.24)',
                  background: 'rgba(10,5,26,0.76)',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Wand2 size={15} color={selectedStyle.color} />
                  <h3 style={{ margin: 0, fontFamily: "'Cinzel', serif", fontSize: 12, color: '#F0EAFF', letterSpacing: '0.08em' }}>
                    スキル変化
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {skillEntries.map(({ skill, level, unlocked, skillId }) => (
                    <div
                      key={skillId}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(34px, auto)',
                        gap: 8,
                        alignItems: 'center',
                        borderRadius: 10,
                        padding: '8px 9px',
                        background: unlocked ? `${selectedStyle.soft}` : 'rgba(255,255,255,0.025)',
                        border: `1px solid ${unlocked ? selectedStyle.color + '44' : 'rgba(255,255,255,0.06)'}`,
                        opacity: unlocked ? 1 : 0.52,
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: '#F0EAFF', fontWeight: 800, overflowWrap: 'anywhere' }}>{skill?.name ?? skillId}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 8, color: selectedStyle.color }}>Lv.{level}</span>
                        </div>
                        <div style={{ marginTop: 3, fontSize: 10, color: '#8b7da8', lineHeight: 1.45 }}>
                          {skill?.description ?? '未定義スキル'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 8, color: selectedStyle.color, whiteSpace: 'nowrap', minWidth: 34 }}>
                        <div>{ELEMENT_LABEL[skill?.element ?? 'NONE'] ?? skill?.element}</div>
                        <div>{skill?.attackType ? ATTACK_LABEL[skill.attackType] : '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {!unlock.unlocked && (
              <div
                style={{
                  marginTop: 10,
                  borderRadius: 12,
                  border: '1px solid rgba(212,175,55,0.34)',
                  background: 'rgba(74,50,8,0.16)',
                  padding: '9px 11px',
                  fontSize: 11,
                  color: '#D4AF37',
                  lineHeight: 1.65,
                }}
              >
                解放条件: {unlock.missing.map((requirement) => formatJobRequirement(requirement.jobId, requirement.minLevel)).join(' / ')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 12, minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setCurrentTab('HOME')}
                style={{
                  flex: '0 0 92px',
                  minHeight: 48,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#8b7da8',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                戻る
              </button>
              <button
                id="tut-job-confirm"
                type="button"
                disabled={isCurrent || !unlock.unlocked}
                onClick={() => changeJob(selectedJobId)}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 12,
                  background: isCurrent || !unlock.unlocked
                    ? 'rgba(255,255,255,0.04)'
                    : `linear-gradient(135deg, ${selectedStyle.color}42, ${selectedStyle.soft})`,
                  border: `1px solid ${isCurrent || !unlock.unlocked ? 'rgba(255,255,255,0.08)' : selectedStyle.color + '88'}`,
                  color: isCurrent ? '#6b5f7a' : unlock.unlocked ? '#F0EAFF' : '#8A6D1F',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  boxShadow: isCurrent || !unlock.unlocked ? 'none' : `0 0 22px ${selectedStyle.glow}`,
                }}
              >
                {isCurrent ? '選択中' : unlock.unlocked ? '転職' : '条件未達成'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
