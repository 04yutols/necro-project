'use client';

import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { motion } from 'framer-motion';
import { Map, Skull, Sword, Terminal, ChevronRight, Activity, Swords, Settings, Sparkles, Lock, HeartPulse, ShieldCheck, Gauge, Target, type LucideIcon } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';
import { getJobLevelProgress } from '../../logic/ExperienceSystem';
import { isAbyssalResidueUnlocked } from '../../logic/AbyssalResidueUnlockSystem';
import { MOTION } from '../../lib/motion';

const THEME = {
  primary: '#BC00FB',
  primaryBg: 'rgba(188,0,251,0.15)',
  primaryBorder: 'rgba(188,0,251,0.5)',
  secondary: '#D4AF37',
  secondaryBg: 'rgba(212,175,55,0.15)',
  secondaryBorder: 'rgba(212,175,55,0.5)',
  tertiary: '#FF6B9B',
  tertiaryBg: 'rgba(255,107,155,0.15)',
  tertiaryBorder: 'rgba(255,107,155,0.5)',
  gray: '#9CA3AF',
  grayBg: 'rgba(55,65,81,0.5)',
  grayBorder: 'rgba(75,85,99,1)'
};

const ExpBar = ({ percent, color }: { percent: number, color: string }) => {
  const totalSegments = 20;
  const filled = Math.floor((percent / 100) * totalSegments);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, minWidth: 0 }}>
      <span style={{ color: '#444', marginRight: '4px' }}>[</span>
      <div style={{ display: 'flex', flex: 1, justifyContent: 'space-between', gap: '2px' }}>
        {Array.from({ length: totalSegments }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: '10px', backgroundColor: i < filled ? color : '#2C2C2C', borderRadius: '1px' }} />
        ))}
      </div>
      <span style={{ color: '#444', marginLeft: '4px' }}>]</span>
    </div>
  );
};

function ProfileStatTile({ label, sub, value, ratio, color, Icon }: {
  label: string;
  sub: string;
  value: string;
  ratio: number;
  color: string;
  Icon: LucideIcon;
}) {
  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 12,
        border: `1px solid ${color}33`,
        background: `linear-gradient(135deg, ${color}16, rgba(255,255,255,0.025))`,
        padding: '9px 10px',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 16px ${color}10`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <Icon size={14} color={color} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 8, color: '#A5A9B4', letterSpacing: '0.14em' }}>
              {label}
            </div>
            <div style={{ fontFamily: "var(--font-noto-sans-jp), sans-serif", fontSize: 9, color: '#7f7193', marginTop: 1 }}>
              {sub}
            </div>
          </div>
        </div>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 17, lineHeight: 1, color: '#F4EEFF', fontWeight: 800, textShadow: `0 0 12px ${color}44`, whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.07)', marginTop: 8, overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.max(3, Math.min(100, ratio))}%`,
            height: '100%',
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color}66, ${color})`,
            boxShadow: `0 0 12px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}

export function HomeHero() {
  const { player, necroStatus, party, setCurrentTab } = useGameStore();

  if (!player) return null;

  const currentJob = player.jobs.find(j => j.jobId === player.currentJobId) || { level: 1, exp: 0 };
  const jobProgress = getJobLevelProgress(currentJob.exp);
  const jobExpRemain = jobProgress.expToNextLevel;
  const jobExpPercent = Math.round(jobProgress.progressRatio * 100);

  const necroLevel = necroStatus?.level || 1;
  const necroNextExp = necroLevel * 2000;
  const necroExp = necroStatus?.exp ?? 0;
  const necroExpRemain = Math.max(0, necroNextExp - necroExp);
  const necroExpPercent = Math.min(100, Math.round((necroExp / necroNextExp) * 100));

  const currentCost = party.reduce((sum, monster) => sum + (monster ? monster.cost : 0), 0);
  const maxCost = necroStatus?.maxCost || 10;
  const goldAmount = player.gold;
  const residueUnlocked = isAbyssalResidueUnlocked(player.clearedStages);
  const combatStats = [
    { label: 'HP', sub: '生命', value: player.stats.hp.toLocaleString(), ratio: (player.stats.hp / 650) * 100, color: '#FF6B9B', Icon: HeartPulse },
    { label: 'ATK', sub: '攻勢', value: player.stats.atk.toLocaleString(), ratio: (player.stats.atk / 180) * 100, color: '#D4AF37', Icon: Target },
    { label: 'DEF', sub: '防衛', value: player.stats.def.toLocaleString(), ratio: (player.stats.def / 160) * 100, color: '#9F8CFF', Icon: ShieldCheck },
    { label: 'SPD', sub: '行動', value: player.stats.spd.toLocaleString(), ratio: (player.stats.spd / 180) * 100, color: '#7DD3FC', Icon: Gauge },
  ];

  const NAV_BUTTONS = [
    { id: 'MAP', label: '出撃・マップ', sub: 'WORLD EXPLORATION', icon: Map, color: THEME.primary, border: THEME.primaryBorder, bg: THEME.primaryBg, glow: '0 0 20px rgba(188,0,251,0.3)' },
    { id: 'JOB', label: '転職・職業', sub: 'UMBRA RITE-HALL', icon: Sparkles, color: '#D4AF37', border: 'rgba(212,175,55,0.48)', bg: 'rgba(212,175,55,0.12)', glow: '0 0 20px rgba(212,175,55,0.22)' },
    {
      id: 'LAB',
      label: residueUnlocked ? 'ネクロラボ' : '深淵の残滓',
      sub: residueUnlocked ? 'NECROMANCY & UPGRADE' : 'CHAPTER 2で解放',
      icon: residueUnlocked ? Skull : Lock,
      color: residueUnlocked ? THEME.tertiary : '#8b7da8',
      border: residueUnlocked ? THEME.tertiaryBorder : 'rgba(139,125,168,0.32)',
      bg: residueUnlocked ? THEME.tertiaryBg : 'rgba(32,26,44,0.42)',
      glow: residueUnlocked ? '0 0 20px rgba(255,107,155,0.3)' : 'none',
      locked: !residueUnlocked,
    },
    { id: 'EQUIP', label: '装備・編成', sub: 'ARMORY & LEGION', icon: Sword, color: THEME.secondary, border: THEME.secondaryBorder, bg: THEME.secondaryBg, glow: '0 0 20px rgba(212,175,55,0.22)' },
    { id: 'LOGS', label: '兵歴記録', sub: 'SYSTEM LOGS', icon: Terminal, color: THEME.gray, border: THEME.grayBorder, bg: THEME.grayBg, glow: '0 0 10px rgba(255,255,255,0.1)' },
  ] as const;

  return (
    <div className="w-full h-full bg-[#050505] overflow-y-auto custom-scrollbar safe-scroll" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 16px calc(env(safe-area-inset-bottom, 0px) + 18px)',
          maxWidth: 500,
          margin: '0 auto',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.slow, ease: 'easeOut' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{
              fontFamily: "var(--font-cinzel-decorative), serif",
              fontSize: 8,
              color: '#8B00FF',
              letterSpacing: '0.2em',
              textShadow: '0 0 10px rgba(139,0,255,0.7)',
            }}>
              NECROMANCE BRAVE
            </div>
            <div style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 18,
              fontWeight: 700,
              color: '#f0ebff',
              letterSpacing: '0.04em',
              lineHeight: 1.1,
            }}>
              拠点
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <AuthPanel />
            <button
              type="button"
              aria-label="設定"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#8b7da8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              <Settings size={16} />
            </button>
          </div>
        </motion.div>
        
        {/* Header Profile UI */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOTION.spring.standard}
          style={{ 
            marginBottom: 18, position: 'relative', borderRadius: 18,
            backgroundColor: '#0A0A0A', border: '1px solid #333', 
            padding: '16px 14px', boxShadow: '0 18px 34px rgba(0,0,0,0.75)',
          }}
        >
          {/* Abstract Background for Profile */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ borderRadius: 18, overflow: 'hidden' }}>
            <div className="absolute -top-1/2 -right-1/4 w-full h-full bg-primary blur-[100px] rounded-full mix-blend-screen" />
            <div className="absolute -bottom-1/4 -left-1/4 w-3/4 h-3/4 bg-[#8B0000] blur-[80px] rounded-full mix-blend-screen" />
          </div>

          <div className="relative z-10 flex flex-col gap-3" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 900, fontSize: '12px', color: '#ccc', letterSpacing: '0.05em' }}>
            
            {/* Header info */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '64px', height: '64px', background: 'radial-gradient(circle at 50% 35%, rgba(188,0,251,0.35), rgba(5,5,5,0.95) 72%)', border: '1px solid rgba(188,0,251,0.45)', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 18px rgba(188,0,251,0.25)', flexShrink: 0, position: 'relative' }}>
                <span style={{ fontFamily: "var(--font-cinzel-decorative), serif", color: '#E5D7FF', fontSize: 24, fontWeight: 700, textShadow: '0 0 14px rgba(188,0,251,0.85)' }}>
                  {(player.name || 'N').slice(0, 1).toUpperCase()}
                </span>
                <img 
                  src={`/images/avatar_${player.currentJobId}.png`} 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  alt="Job Pixel Art" 
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated', filter: 'contrast(1.1) brightness(1.1)' }}
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' }}>
                <span style={{ fontSize: '22px', color: '#FFF', letterSpacing: '0.1em', lineHeight: 1 }}>{player.name}</span>
                <div style={{ display: 'grid', gridTemplateColumns: '75px 1fr', gap: '4px', alignItems: 'baseline' }}>
                  <span style={{ color: '#A5A9B4' }}>現在の職業：</span>
                  <div>
                    <span style={{ color: THEME.primary, display: 'inline-block', width: '70px', letterSpacing: '0.05em' }}>{player.currentJobId.toUpperCase()}</span>
                    <span style={{ color: '#FFF' }}>Lv. {currentJob.level}</span>
                  </div>
                  <span style={{ color: '#A5A9B4' }}>死霊術：</span>
                  <div>
                    <span style={{ color: THEME.tertiary, display: 'inline-block', width: '70px', letterSpacing: '0.05em' }}>RANK {necroStatus?.rank || 1}</span>
                    <span style={{ color: '#FFF' }}>Lv. {necroLevel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* HP/MP Box */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', padding: '12px 16px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '16px', border: '1px solid #222', marginTop: '4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#A5A9B4', fontSize: '11px' }}>HP</span>
                <span style={{ color: '#FF4D4D', fontFamily: 'system-ui, sans-serif', fontSize: '18px', textShadow: '0 0 10px rgba(255,77,77,0.3)', lineHeight: 1 }}>
                  {player.stats.hp} <span style={{ color: '#8b7da8', fontSize: '14px' }}>/ {(player.stats as any).maxHp ?? player.stats.hp}</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#A5A9B4', fontSize: '11px' }}>MP</span>
                <span style={{ color: '#4A90E2', fontFamily: 'system-ui, sans-serif', fontSize: '18px', textShadow: '0 0 10px rgba(74,144,226,0.3)', lineHeight: 1 }}>
                  {player.currentEnergy} <span style={{ color: '#8b7da8', fontSize: '14px' }}>/ {player.maxEnergy}</span>
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {combatStats.map((stat) => (
                <ProfileStatTile key={stat.label} {...stat} />
              ))}
            </div>

            {/* EXP Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                 <span style={{ color: THEME.primary, width: '85px', flexShrink: 0, textAlign: 'right', paddingRight: '8px' }}>JOB-EXP:</span>
                 <ExpBar percent={jobExpPercent} color={THEME.primary} />
                 <span style={{ color: '#8b7da8', width: '85px', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>あと {jobExpRemain.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                 <span style={{ color: THEME.tertiary, width: '85px', flexShrink: 0, textAlign: 'right', paddingRight: '8px' }}>NECRO-EXP:</span>
                 <ExpBar percent={necroExpPercent} color={THEME.tertiary} />
                 <span style={{ color: '#8b7da8', width: '85px', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>あと {necroExpRemain.toLocaleString()}</span>
              </div>
            </div>

            {/* Gold & Cost Box */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', padding: '12px 16px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '16px', border: '1px solid #222', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#A5A9B4', fontSize: '11px' }}>所持金</span>
                <span style={{ color: '#FCD34D', fontSize: '16px', letterSpacing: '0.05em' }}>{goldAmount.toLocaleString()}G</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#A5A9B4', fontSize: '11px' }}>軍団コスト</span>
                <span style={{ color: '#FFF', fontSize: '16px' }}>{currentCost} <span style={{ color: '#8b7da8', fontSize: '13px' }}>/ {maxCost}</span></span>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Primary Actions Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* FORMATION hero button */}
          <motion.button
            type="button"
            aria-label="軍団編成へ移動"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={MOTION.spring.standard}
            onClick={() => setCurrentTab('EQUIP')}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              minHeight: 72, padding: '0 18px', borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(140,0,230,0.35), rgba(180,0,80,0.22))',
              border: '1px solid rgba(204,34,255,0.6)',
              boxShadow: '0 0 28px rgba(188,0,251,0.35), inset 0 0 30px rgba(0,0,0,0.4)',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              position: 'relative', width: '100%', textAlign: 'left', appearance: 'none', fontFamily: 'inherit',
            }}
          >
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 16, overflow: 'hidden',
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(188,0,251,0.1), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2.5s infinite',
            }}/>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: 'rgba(140,0,230,0.3)', border: '1px solid rgba(204,34,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E080FF',
            }}>
              <Swords size={22} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#F4EEFF', letterSpacing: '0.08em', fontFamily: "var(--font-cinzel-decorative), serif", textShadow: '0 0 14px rgba(204,34,255,0.6)' }}>
                軍団編成
              </div>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(204,80,255,0.75)', letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 2 }}>
                ARMY FORMATION
              </div>
            </div>
            <ChevronRight size={20} style={{ color: 'rgba(204,80,255,0.7)', flexShrink: 0 }} />
          </motion.button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
              <Activity size={16} color={THEME.secondary} opacity={0.8} />
            <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#A5A9B4', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
              作戦司令室
            </h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
            {NAV_BUTTONS.map((btn, index) => {
              const Icon = btn.icon;
              const isLocked = 'locked' in btn && btn.locked;
              return (
                <motion.button
                  type="button"
                  disabled={isLocked}
                  key={btn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...MOTION.spring.standard, delay: index * 0.1 }}
                  onClick={() => {
                    if (isLocked) return;
                    setCurrentTab(btn.id as any);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', padding: '16px 16px', borderRadius: '16px',
                    border: `1px solid ${btn.border}`, background: btn.bg,
                    boxShadow: `0 2px 20px ${btn.color}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
                    cursor: isLocked ? 'not-allowed' : 'pointer', WebkitTapHighlightColor: 'transparent',
                    position: 'relative', width: '100%', textAlign: 'left', appearance: 'none', fontFamily: 'inherit',
                    opacity: isLocked ? 0.72 : 1,
                  }}
                >
                  {/* Shimmer overlay */}
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '16px',
                    backgroundImage: `linear-gradient(90deg, transparent, ${btn.color}0f, transparent)`,
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 3s infinite',
                    pointerEvents: 'none',
                  }}/>
                  <div style={{
                    width: '48px', height: '48px', borderRadius: '14px', backgroundColor: 'rgba(0,0,0,0.5)',
                    border: `1px solid ${btn.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: btn.color, boxShadow: `0 0 12px ${btn.color}30`,
                  }}>
                    <Icon size={22} strokeWidth={2} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '14px', flex: 1, textAlign: 'left' }}>
                    <span style={{ fontFamily: "'Cinzel', serif", fontSize: '16px', fontWeight: 700, color: '#f0ebff', letterSpacing: '0.02em' }}>
                      {btn.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: '9px', fontWeight: 600, color: btn.color + '90', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '3px' }}>
                      {btn.sub}
                    </span>
                  </div>

                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    background: `${btn.color}18`, border: `1px solid ${btn.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: btn.color, fontSize: '11px', fontWeight: 700,
                  }}>{isLocked ? <Lock size={13} /> : '›'}</div>
                </motion.button>
              );
            })}
          </div>
        </div>
        
        {/* Footer: N logo + クイック出撃 */}
        <div style={{ marginTop: 'auto', paddingTop: '16px', paddingBottom: '16px', display: 'flex', alignItems: 'center', animation: 'fadeSlideUp 0.5s ease-out 0.5s both' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            background: 'linear-gradient(135deg, #1a0a2e, #0d0520)',
            border: '2px solid #8B00FF60',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            animation: 'nGlow 3s ease-in-out infinite',
            boxShadow: '0 0 10px #8B00FF60',
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-cinzel-decorative), serif", fontSize: '16px', fontWeight: 700, color: '#c084fc' }}>N</span>
          </div>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            aria-label="クイック出撃"
            onClick={() => setCurrentTab('MAP')}
            style={{
              padding: '8px 16px',
              background: 'linear-gradient(135deg, rgba(139,0,255,0.25), rgba(88,28,135,0.15))',
              border: '1px solid rgba(139,0,255,0.45)',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 0 12px rgba(139,0,255,0.2)',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 12 }}>⚡</span>
            <span style={{ fontFamily: "'Cinzel', serif", fontSize: '10px', fontWeight: 600, color: '#c084fc', letterSpacing: '0.06em' }}>クイック出撃</span>
          </button>
        </div>
      </div>
    </div>
  );
}
