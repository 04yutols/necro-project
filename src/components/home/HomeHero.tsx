'use client';

import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { motion } from 'framer-motion';
import { Map, Skull, Sword, Terminal, ChevronRight, Activity } from 'lucide-react';

const THEME = {
  primary: '#BC00FB',
  primaryBg: 'rgba(188,0,251,0.15)',
  primaryBorder: 'rgba(188,0,251,0.5)',
  secondary: '#00FFFF',
  secondaryBg: 'rgba(0,255,255,0.15)',
  secondaryBorder: 'rgba(0,255,255,0.5)',
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

export function HomeHero() {
  const { player, necroStatus, party, setCurrentTab } = useGameStore();

  if (!player) return null;

  // Real or mock data processing
  const currentJob = player.jobs.find(j => j.jobId === player.currentJobId) || { level: 1, exp: 0 };
  const jobNextExp = currentJob.level * 1000;
  const jobExpRemain = 450; // Requested mock value
  const jobExpPercent = 80;

  const necroLevel = necroStatus?.level || 1;
  const necroNextExp = necroLevel * 2000;
  const necroExpRemain = 2800; // Requested mock value
  const necroExpPercent = 40;

  const currentCost = party.reduce((sum, monster) => sum + (monster ? monster.cost : 0), 0);
  const maxCost = necroStatus?.maxCost || 10;
  const goldAmount = 50000; // Requested mock value

  const NAV_BUTTONS = [
    { id: 'MAP', label: '出撃・マップ', sub: 'WORLD EXPLORATION', icon: Map, color: THEME.primary, border: THEME.primaryBorder, bg: THEME.primaryBg, glow: '0 0 20px rgba(188,0,251,0.3)' },
    { id: 'LAB', label: 'ネクロラボ', sub: 'NECROMANCY & UPGRADE', icon: Skull, color: THEME.tertiary, border: THEME.tertiaryBorder, bg: THEME.tertiaryBg, glow: '0 0 20px rgba(255,107,155,0.3)' },
    { id: 'EQUIP', label: '装備・編成', sub: 'ARMORY & LEGION', icon: Sword, color: THEME.secondary, border: THEME.secondaryBorder, bg: THEME.secondaryBg, glow: '0 0 20px rgba(0,255,255,0.3)' },
    { id: 'LOGS', label: '兵歴記録', sub: 'SYSTEM LOGS', icon: Terminal, color: THEME.gray, border: THEME.grayBorder, bg: THEME.grayBg, glow: '0 0 10px rgba(255,255,255,0.1)' },
  ] as const;

  return (
    <div className="w-full h-full bg-[#050505] overflow-y-auto custom-scrollbar" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '64px 20px 32px 20px', maxWidth: '500px', margin: '0 auto', justifyContent: 'center' }}>
        
        {/* Header Profile UI */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ 
            marginBottom: '24px', position: 'relative', borderRadius: '24px', 
            backgroundColor: '#0A0A0A', border: '1px solid #333', 
            padding: '24px 20px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
          }}
        >
          {/* Abstract Background for Profile */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -top-1/2 -right-1/4 w-full h-full bg-primary blur-[100px] rounded-full mix-blend-screen" />
            <div className="absolute -bottom-1/4 -left-1/4 w-3/4 h-3/4 bg-[#8B0000] blur-[80px] rounded-full mix-blend-screen" />
          </div>

          <div className="relative z-10 flex flex-col gap-3" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 900, fontSize: '12px', color: '#ccc', letterSpacing: '0.05em' }}>
            
            {/* Header info */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: '#FFF', border: '2px solid #333', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', flexShrink: 0 }}>
                <img 
                  src={`/images/avatar_${player.currentJobId}.png`} 
                  onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.currentJobId}` }}
                  alt="Job Pixel Art" 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated', filter: 'contrast(1.1) brightness(1.1)' }} 
                />
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' }}>
                <span style={{ fontSize: '22px', color: '#FFF', letterSpacing: '0.1em', lineHeight: 1 }}>{player.name}</span>
                <div style={{ display: 'grid', gridTemplateColumns: '75px 1fr', gap: '4px', alignItems: 'baseline' }}>
                  <span style={{ color: '#888' }}>現在の職業：</span>
                  <div>
                    <span style={{ color: THEME.primary, display: 'inline-block', width: '70px', letterSpacing: '0.05em' }}>{player.currentJobId.toUpperCase()}</span>
                    <span style={{ color: '#FFF' }}>Lv. {currentJob.level}</span>
                  </div>
                  <span style={{ color: '#888' }}>死霊術：</span>
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
                <span style={{ color: '#888', fontSize: '11px' }}>HP</span>
                <span style={{ color: '#FF4D4D', fontFamily: 'system-ui, sans-serif', fontSize: '18px', textShadow: '0 0 10px rgba(255,77,77,0.3)', lineHeight: 1 }}>
                  {player.stats.hp} <span style={{ color: '#555', fontSize: '14px' }}>/ {(player.stats as any).maxHp ?? 100}</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#888', fontSize: '11px' }}>MP</span>
                <span style={{ color: '#4A90E2', fontFamily: 'system-ui, sans-serif', fontSize: '18px', textShadow: '0 0 10px rgba(74,144,226,0.3)', lineHeight: 1 }}>
                  {player.stats.mp} <span style={{ color: '#555', fontSize: '14px' }}>/ {(player.stats as any).maxMp ?? 20}</span>
                </span>
              </div>
            </div>

            {/* EXP Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                 <span style={{ color: THEME.primary, width: '85px', flexShrink: 0, textAlign: 'right', paddingRight: '8px' }}>JOB-EXP:</span>
                 <ExpBar percent={jobExpPercent} color={THEME.primary} />
                 <span style={{ color: '#666', width: '85px', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>あと {jobExpRemain.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                 <span style={{ color: THEME.tertiary, width: '85px', flexShrink: 0, textAlign: 'right', paddingRight: '8px' }}>NECRO-EXP:</span>
                 <ExpBar percent={necroExpPercent} color={THEME.tertiary} />
                 <span style={{ color: '#666', width: '85px', flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap' }}>あと {necroExpRemain.toLocaleString()}</span>
              </div>
            </div>

            {/* Gold & Cost Box */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', padding: '12px 16px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '16px', border: '1px solid #222', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#888', fontSize: '11px' }}>所持金</span>
                <span style={{ color: '#FCD34D', fontSize: '16px', letterSpacing: '0.05em' }}>{goldAmount.toLocaleString()}G</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: '#888', fontSize: '11px' }}>軍団コスト</span>
                <span style={{ color: '#FFF', fontSize: '16px' }}>{currentCost} <span style={{ color: '#555', fontSize: '13px' }}>/ {maxCost}</span></span>
              </div>
            </div>

          </div>
        </motion.div>

        {/* Primary Actions Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px' }}>
            <Activity size={16} color={THEME.secondary} opacity={0.8} />
            <h3 style={{ fontSize: '12px', fontWeight: 900, color: '#888', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>
              作戦司令室
            </h3>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {NAV_BUTTONS.map((btn, index) => {
              const Icon = btn.icon;
              return (
                <motion.div
                  role="button"
                  key={btn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 300, damping: 25 }}
                  onClick={() => setCurrentTab(btn.id as any)}
                  style={{ 
                    display: 'flex', alignItems: 'center', padding: '16px', borderRadius: '20px', 
                    border: `1px solid ${btn.border}`, backgroundColor: btn.bg, 
                    boxShadow: btn.glow, cursor: 'pointer', WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  <div style={{ 
                    width: '56px', height: '56px', borderRadius: '14px', backgroundColor: 'rgba(0,0,0,0.6)', 
                    border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    flexShrink: 0, color: btn.color, boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                  }}>
                    <Icon size={28} strokeWidth={2} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '16px', flex: 1, textAlign: 'left' }}>
                    <span style={{ fontSize: '17px', fontWeight: 900, color: '#FFF', letterSpacing: '0.1em', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                      {btn.label}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 900, color: btn.color, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.9, marginTop: '4px' }}>
                      {btn.sub}
                    </span>
                  </div>

                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.4)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: btn.color 
                  }}>
                    <ChevronRight size={20} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
        
        {/* Footer Info */}
        <div style={{ marginTop: 'auto', paddingTop: '32px', paddingBottom: '16px', display: 'flex', justifyContent: 'center', opacity: 0.7 }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 24px', 
            borderRadius: '999px', border: '1px solid #1A1A1A', backgroundColor: 'rgba(0,0,0,0.5)' 
          }}>
            <div style={{ width: '6px', height: '6px', backgroundColor: THEME.secondary, borderRadius: '50%', boxShadow: `0 0 8px ${THEME.secondary}` }} />
            <span style={{ fontSize: '10px', fontWeight: 900, color: '#666', letterSpacing: '0.4em', textTransform: 'uppercase' }}>
              SYSTEM ONLINE
            </span>
            <div style={{ width: '6px', height: '6px', backgroundColor: THEME.secondary, borderRadius: '50%', boxShadow: `0 0 8px ${THEME.secondary}` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
