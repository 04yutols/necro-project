'use client';

import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { CapsuleStatBar } from '../ui/CapsuleStatBar';
import { motion } from 'framer-motion';
import { Map, Skull, Sword, Terminal, ChevronRight, Activity } from 'lucide-react';

// Hardcoded theme colors to bypass Safari/Tailwind caching issues
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

export function HomeHero() {
  const { player, setCurrentTab } = useGameStore();

  if (!player) return null;

  const NAV_BUTTONS = [
    { id: 'MAP', label: '出撃・マップ', sub: 'WORLD EXPLORATION', icon: Map, color: THEME.primary, border: THEME.primaryBorder, bg: THEME.primaryBg, glow: '0 0 20px rgba(188,0,251,0.3)' },
    { id: 'LAB', label: 'ネクロラボ', sub: 'NECROMANCY & UPGRADE', icon: Skull, color: THEME.tertiary, border: THEME.tertiaryBorder, bg: THEME.tertiaryBg, glow: '0 0 20px rgba(255,107,155,0.3)' },
    { id: 'EQUIP', label: '装備・編成', sub: 'ARMORY & LEGION', icon: Sword, color: THEME.secondary, border: THEME.secondaryBorder, bg: THEME.secondaryBg, glow: '0 0 20px rgba(0,255,255,0.3)' },
    { id: 'LOGS', label: '兵歴記録', sub: 'SYSTEM LOGS', icon: Terminal, color: THEME.gray, border: THEME.grayBorder, bg: THEME.grayBg, glow: '0 0 10px rgba(255,255,255,0.1)' },
  ] as const;

  return (
    <div className="w-full h-full bg-[#050505] overflow-y-auto custom-scrollbar" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '64px 20px 32px 20px', maxWidth: '500px', margin: '0 auto', justifyContent: 'center' }}>
        {/* Header Profile Section */}
        <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ 
          marginBottom: '24px', position: 'relative', borderRadius: '24px', 
          backgroundColor: '#0A0A0A', border: '1px solid #333', 
          padding: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' 
        }}
      >
        <div className="relative z-10 flex flex-col gap-5">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ 
              width: '90px', height: '90px', minWidth: '90px', minHeight: '90px',
              backgroundColor: '#000', border: '3px solid #1A1A1A', 
              borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              overflow: 'hidden', position: 'relative', boxShadow: '0 0 30px rgba(0,0,0,0.8)'
            }}>
              <img 
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Necro&backgroundColor=050505&mood[]=sad" 
                alt="Avatar"
                style={{ width: '130%', height: 'auto', filter: 'grayscale(100%) contrast(140%)', transform: 'translateY(12px)' }}
              />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '50%', background: 'linear-gradient(to top, rgba(0,0,0,1), transparent)' }} />
              <div style={{ 
                position: 'absolute', top: '4px', right: '4px', padding: '2px 6px', 
                backgroundColor: 'rgba(188,0,251,0.2)', border: '1px solid rgba(188,0,251,0.5)', 
                fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', color: THEME.primary, 
                borderRadius: '4px', boxShadow: '0 0 10px rgba(188,0,251,0.5)' 
              }}>
                LV.99
              </div>
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: 900, color: '#666', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '2px' }}>
                Commander
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.1em', marginBottom: '4px' }}>
                {player.name || 'NECROMANCER'}
              </h2>
              <div style={{ fontSize: '12px', fontWeight: 900, color: THEME.primary, letterSpacing: '0.3em', textTransform: 'uppercase', textShadow: '0 0 10px rgba(188,0,251,0.6)' }}>
                {player.currentJobId}
              </div>
            </div>
          </div>
          
          <div style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '16px', border: '1px solid #1A1A1A', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '100%', marginBottom: '12px' }}>
              <CapsuleStatBar label="HP" value={player.stats.hp} max={player.stats.maxHp || 100} type="hp" />
            </div>
            <div style={{ width: '100%' }}>
              <CapsuleStatBar label="MP" value={player.stats.mp} max={player.stats.maxMp || 20} type="mp" />
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
