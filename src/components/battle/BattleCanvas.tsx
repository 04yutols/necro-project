'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import ResultScreen from './ResultScreen';

interface BattleCanvasProps {
  onEnd: () => void;
}

// ── ENEMY STATE ───────────────────────────────────────────────────────────────
interface EnemyState {
  id: number; name: string; nameEn: string;
  hp: number; maxHp: number; atk: number; color: string;
  pos: 'left' | 'center' | 'right'; size: number;
  targeted: boolean; hit?: boolean;
}
const INIT_ENEMIES: EnemyState[] = [
  { id: 0, name: '霊体騎士', nameEn: 'WRAITH KNIGHT', hp: 340, maxHp: 340, atk: 85,  color: '#06b6d4', pos: 'left',   size: 0.78, targeted: false },
  { id: 1, name: '骨巨人',   nameEn: 'BONE GIANT',    hp: 580, maxHp: 580, atk: 120, color: '#8A2BE2', pos: 'center', size: 1.0,  targeted: true  },
  { id: 2, name: '死骨竜',   nameEn: 'UNDEAD WYRM',   hp: 420, maxHp: 420, atk: 100, color: '#ef4444', pos: 'right',  size: 0.88, targeted: false },
];

// ── SKILLS / ITEMS ─────────────────────────────────────────────────────────────
const SKILLS = [
  { id: 0, name: '骸骨波',   mp: 15, power: 180, icon: '💥', aoe: true  },
  { id: 1, name: '死の抱擁', mp: 20, power: 250, icon: '💀', aoe: false },
  { id: 2, name: '冥土送り', mp: 30, power: 320, icon: '🌀', aoe: false },
  { id: 3, name: '怨霊召喚', mp: 25, power: 200, icon: '👻', aoe: true  },
];
const DEMON_SKILLS = [
  { id: 10, name: '魔神爪',   cost: 'HP-50',  power: 420, icon: '⚡', aoe: false, demonOnly: true },
  { id: 11, name: '黒焔爆発', cost: '全消費', power: 680, icon: '🔥', aoe: true,  demonOnly: true },
  { id: 12, name: '魂喰い',   cost: 'HP-80',  power: 360, icon: '🌑', aoe: false, demonOnly: true },
];
const ITEMS = [
  { id: 0, name: '冥界薬',   desc: 'HP+200 回復', count: 3, icon: '🧪', effect: 'heal',   value: 200 },
  { id: 1, name: 'エーテル', desc: 'MP全回復',     count: 2, icon: '💎', effect: 'mpHeal', value: 100 },
];

// ── SVG ENEMIES ───────────────────────────────────────────────────────────────
function WraithKnightSVG({ hit, targeted, color }: { hit?: boolean; targeted: boolean; color: string }) {
  return (
    <svg viewBox="0 0 80 130" fill="none" style={{
      width: '100%', height: '100%',
      animation: hit ? 'enemyHit 0.5s ease-out' : 'breathe 3.5s ease-in-out infinite',
      filter: targeted ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 18px ${color}90)` : `drop-shadow(0 0 3px ${color}50)`,
      transition: 'filter 0.3s ease',
    }}>
      <defs><radialGradient id="wkGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={color} stopOpacity="0.3"/><stop offset="100%" stopColor={color} stopOpacity="0"/></radialGradient></defs>
      <ellipse cx="45" cy="115" rx="28" ry="6" fill={color} opacity="0.2"/>
      <ellipse cx="45" cy="60" rx="35" ry="55" fill="url(#wkGlow)"/>
      <path d="M22 55 Q15 85 18 115 L72 115 Q75 85 68 55 Z" fill="#0a0420" opacity="0.9"/>
      <path d="M22 52 Q10 45 12 60 Q14 72 24 68 L32 58Z" fill="#150828" stroke={color} strokeWidth="0.7" strokeOpacity="0.6"/>
      <path d="M68 52 Q80 45 78 60 Q76 72 66 68 L58 58Z" fill="#150828" stroke={color} strokeWidth="0.7" strokeOpacity="0.6"/>
      <path d="M30 52 Q45 46 60 52 L58 88 Q45 94 32 88Z" fill="#100520" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
      <circle cx="45" cy="68" r="10" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.7"/>
      <path d="M45 59 L47 65 L45 77 L43 65Z" fill={color} opacity="0.8"/>
      <path d="M36 68 L42 66 L54 68 L42 70Z" fill={color} opacity="0.8"/>
      <path d="M30 58 Q15 70 12 90 L22 92 Q28 74 36 64Z" fill="#0d0520" opacity="0.7"/>
      <path d="M60 58 Q75 70 78 90 L68 92 Q62 74 54 64Z" fill="#0d0520" opacity="0.7"/>
      <rect x="6" y="30" width="3" height="75" rx="1.5" fill="#1a0a2e"/>
      <rect x="7" y="30" width="1.5" height="75" rx="0.5" fill={color} opacity="0.6"/>
      <path d="M9 32 Q22 25 26 38 Q22 42 9 42Z" fill={color} opacity="0.8"/>
      <ellipse cx="40" cy="126" rx="24" ry="5" fill={color} opacity="0.25"/>
      <polygon points="8,54 4,42 14,52" fill={color} opacity="0.9"/>
      <polygon points="72,54 76,42 66,52" fill={color} opacity="0.9"/>
      <rect x="34" y="48" width="12" height="14" rx="3" fill="#0d0420"/>
      <ellipse cx="40" cy="36" rx="20" ry="18" fill="#ddd6c8"/>
      <path d="M20 30 Q20 14 40 12 Q60 14 60 30 L57 40 Q48 34 40 34 Q32 34 23 40Z" fill="#160830" stroke={color} strokeWidth="1.2" strokeOpacity="0.9"/>
      <polygon points="28,22 24,8 32,20" fill={color} opacity="0.95"/>
      <polygon points="40,18 40,4 44,18" fill={color} opacity="0.95"/>
      <polygon points="52,22 56,8 48,20" fill={color} opacity="0.95"/>
      <ellipse cx="27" cy="38" rx="6" ry="5" fill="#ddd6c8"/>
      <ellipse cx="53" cy="38" rx="6" ry="5" fill="#ddd6c8"/>
      <ellipse cx="33" cy="34" rx="7" ry="7" fill="#050210"/>
      <ellipse cx="47" cy="34" rx="7" ry="7" fill="#050210"/>
      <ellipse cx="33" cy="34" rx="5" ry="5" fill={color} opacity="0.95"/>
      <ellipse cx="47" cy="34" rx="5" ry="5" fill={color} opacity="0.95"/>
      <ellipse cx="33" cy="34" rx="2.5" ry="2.5" fill="#fff"/>
      <ellipse cx="47" cy="34" rx="2.5" ry="2.5" fill="#fff"/>
      <ellipse cx="33" cy="34" rx="7" ry="7" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8"/>
      <ellipse cx="47" cy="34" rx="7" ry="7" fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.8"/>
      <path d="M37 42 L40 47 L43 42Z" fill="#050210"/>
      <path d="M26 50 Q40 60 54 50 L54 54 Q40 64 26 54Z" fill="#c8c0b0"/>
      {[30,35,40,45,50].map((x,i) => <polygon key={i} points={`${x},53 ${x-2.5},60 ${x+2.5},60`} fill="#ddd6c8"/>)}
    </svg>
  );
}

function BoneGiantSVG({ hit, targeted, color }: { hit?: boolean; targeted: boolean; color: string }) {
  return (
    <svg viewBox="0 0 120 150" fill="none" style={{
      width: '100%', height: '100%',
      animation: hit ? 'enemyHit 0.5s ease-out' : 'breathe 4s ease-in-out infinite',
      filter: targeted ? `drop-shadow(0 0 10px ${color}) drop-shadow(0 0 22px ${color}60)` : 'none',
      transition: 'filter 0.3s ease',
    }}>
      <defs><radialGradient id="bgGlow" cx="50%" cy="60%" r="50%"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></radialGradient></defs>
      <ellipse cx="60" cy="145" rx="40" ry="8" fill={color} opacity="0.2"/>
      <ellipse cx="60" cy="75" rx="55" ry="72" fill="url(#bgGlow)"/>
      <path d="M42 112 Q36 130 38 145 L52 145 Q52 130 54 112Z" fill="#c8bfb0"/>
      <path d="M78 112 Q72 130 68 145 L82 145 Q84 130 84 112Z" fill="#c8bfb0"/>
      <ellipse cx="45" cy="125" rx="9" ry="7" fill="#e0d8c8" stroke={color} strokeWidth="0.5" strokeOpacity="0.4"/>
      <ellipse cx="75" cy="125" rx="9" ry="7" fill="#e0d8c8" stroke={color} strokeWidth="0.5" strokeOpacity="0.4"/>
      <path d="M32 65 Q32 110 36 115 L84 115 Q88 110 88 65 Q88 50 60 46 Q32 50 32 65Z" fill="#d4ccbc"/>
      <path d="M32 65 Q32 110 36 115 L84 115 Q88 110 88 65 Q88 50 60 46 Q32 50 32 65Z" fill={color} fillOpacity="0.08"/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <path d={`M46 ${68+i*10} Q40 ${73+i*10} 42 ${78+i*10} L46 ${76+i*10}`} stroke={color} strokeWidth="1.2" strokeOpacity="0.5" fill="none"/>
          <path d={`M74 ${68+i*10} Q80 ${73+i*10} 78 ${78+i*10} L74 ${76+i*10}`} stroke={color} strokeWidth="1.2" strokeOpacity="0.5" fill="none"/>
          <line x1="46" y1={68+i*10} x2="74" y2={68+i*10} stroke={color} strokeWidth="0.8" strokeOpacity="0.3"/>
        </g>
      ))}
      {[0,1,2,3,4,5].map(i => <ellipse key={i} cx="60" cy={65+i*9} rx="4" ry="3.5" fill="#bfb8a8" stroke={color} strokeWidth="0.5" strokeOpacity="0.4"/>)}
      <ellipse cx="30" cy="62" rx="14" ry="12" fill="#d4ccbc" stroke={color} strokeWidth="0.6" strokeOpacity="0.4"/>
      <ellipse cx="90" cy="62" rx="14" ry="12" fill="#d4ccbc" stroke={color} strokeWidth="0.6" strokeOpacity="0.4"/>
      <path d="M16 62 Q4 90 8 118 L18 118 Q20 92 30 66Z" fill="#c8bfb0"/>
      <path d="M104 62 Q116 90 112 118 L102 118 Q100 92 90 66Z" fill="#c8bfb0"/>
      <ellipse cx="13" cy="122" rx="9" ry="7" fill="#bfb8a8" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
      <ellipse cx="107" cy="122" rx="9" ry="7" fill="#bfb8a8" stroke={color} strokeWidth="0.8" strokeOpacity="0.5"/>
      <rect x="52" y="36" width="16" height="14" rx="4" fill="#bfb8a8"/>
      <ellipse cx="60" cy="22" rx="26" ry="24" fill="#e8e0d0"/>
      <path d="M58 4 L56 14 L60 18 L62 28" stroke={color} strokeWidth="0.8" strokeOpacity="0.6" fill="none"/>
      <path d="M38 16 L50 20" stroke="#4a3a3a" strokeWidth="2" strokeLinecap="round"/>
      <path d="M82 16 L70 20" stroke="#4a3a3a" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="48" cy="23" rx="8" ry="7" fill="#03020a"/>
      <ellipse cx="72" cy="23" rx="8" ry="7" fill="#03020a"/>
      <ellipse cx="48" cy="23" rx="5" ry="4.5" fill={color} opacity="0.9"/>
      <ellipse cx="72" cy="23" rx="5" ry="4.5" fill={color} opacity="0.9"/>
      <ellipse cx="48" cy="23" rx="2.5" ry="2.5" fill="#fff" opacity="0.95"/>
      <ellipse cx="72" cy="23" rx="2.5" ry="2.5" fill="#fff" opacity="0.95"/>
      <path d="M57 30 L60 36 L63 30Z" fill="#03020a"/>
      <path d="M38 40 Q60 52 82 40" stroke="#d0c8b8" strokeWidth="2" fill="none"/>
      {[42,50,58,66,74].map((x,i) => <path key={i} d={`M${x} 42 L${x} 49`} stroke="#e8e0d0" strokeWidth="2.2" strokeLinecap="round"/>)}
      <path d="M38 6 Q28 -8 34 -14 Q42 -2 46 8Z" fill="#8a8278" opacity="0.9"/>
      <path d="M82 6 Q92 -8 86 -14 Q78 -2 74 8Z" fill="#8a8278" opacity="0.9"/>
    </svg>
  );
}

function BoneDragonSVG({ hit, targeted, color }: { hit?: boolean; targeted: boolean; color: string }) {
  return (
    <svg viewBox="0 0 140 110" fill="none" style={{
      width: '100%', height: '100%',
      animation: hit ? 'enemyHit 0.5s ease-out' : 'breathe 3s ease-in-out infinite 0.8s',
      filter: targeted ? `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 20px ${color}60)` : `drop-shadow(0 0 3px ${color}50)`,
      transition: 'filter 0.3s ease',
    }}>
      <ellipse cx="80" cy="108" rx="42" ry="5" fill={color} opacity="0.2"/>
      <path d="M118 80 Q132 65 136 50 Q138 36 130 30 Q122 26 118 38 Q114 52 108 66Z" fill="#c8bfb0"/>
      <path d="M130 30 L138 22 L128 28Z" fill="#bfb8a8"/>
      <path d="M38 70 Q60 60 90 62 Q112 64 128 72 Q130 80 126 86 Q108 88 88 86 Q62 84 42 80Z" fill="#d4ccbc"/>
      <path d="M38 70 Q60 60 90 62 Q112 64 128 72 Q130 80 126 86 Q108 88 88 86 Q62 84 42 80Z" fill={color} fillOpacity="0.07"/>
      {[[50,63],[62,60],[74,60],[86,61],[98,64],[110,68],[120,73]].map(([x,y],i) => (
        <polygon key={i} points={`${x},${y} ${x-3},${y-8} ${x+3},${y-8}`} fill="#bfb8a8" stroke={color} strokeWidth="0.5" strokeOpacity="0.5"/>
      ))}
      <path d="M72 65 Q40 35 12 8 Q38 28 65 58Z" fill="#100420" stroke={color} strokeWidth="1" strokeOpacity="0.7"/>
      <path d="M80 62 Q68 25 72 4 Q88 24 90 58Z" fill="#150530" stroke={color} strokeWidth="0.9" strokeOpacity="0.6"/>
      <path d="M72 64 Q44 38 16 12" stroke={color} strokeWidth="0.8" strokeOpacity="0.6" fill="none"/>
      <path d="M75 62 Q66 36 70 10" stroke={color} strokeWidth="0.6" strokeOpacity="0.4" fill="none"/>
      <path d="M40 72 Q28 62 18 50 Q14 42 18 36 Q24 30 32 36 Q40 42 46 60 L42 78Z" fill="#c8bfb0"/>
      <polygon points="24,48 20,40 28,40" fill="#bfb8a8"/>
      <polygon points="30,42 27,34 34,34" fill="#bfb8a8"/>
      <path d="M8 36 Q6 28 10 22 Q16 16 24 20 Q30 24 34 32 Q32 40 24 44 Q14 46 8 36Z" fill="#d4ccbc"/>
      <path d="M8 32 Q0 28 -4 26 Q0 24 6 28Z" fill="#c8bfb0"/>
      <path d="M8 38 Q2 44 -2 48 Q4 50 10 44Z" fill="#bfb8a8"/>
      {[[-2,28],[2,26],[6,27]].map(([x,y],i) => <polygon key={i} points={`${x},${y} ${x-2},${y+7} ${x+2},${y+7}`} fill="#e8e0d0"/>)}
      {[[0,44],[4,46]].map(([x,y],i) => <polygon key={i} points={`${x},${y} ${x-2},${y-6} ${x+2},${y-6}`} fill="#ddd6c8"/>)}
      <path d="M16 20 Q12 8 16 2 Q22 8 22 20Z" fill="#8a8278"/>
      <path d="M22 19 Q22 8 28 4 Q32 10 28 20Z" fill="#8a8278"/>
      <ellipse cx="22" cy="30" rx="5" ry="5" fill="#050210"/>
      <ellipse cx="22" cy="30" rx="3.5" ry="3.5" fill={color} opacity="0.95"/>
      <ellipse cx="23" cy="29" rx="1.5" ry="1.5" fill="#fff"/>
      <circle cx="22" cy="30" r="5" fill="none" stroke={color} strokeWidth="1.3" strokeOpacity="0.9"/>
      <path d="M-4 30 Q-14 26 -18 22" stroke={color} strokeWidth="4" strokeOpacity="0.8" fill="none" strokeLinecap="round"/>
      <path d="M-4 34 Q-16 34 -20 32" stroke={color} strokeWidth="2.5" strokeOpacity="0.55" fill="none" strokeLinecap="round"/>
      <path d="M-2 38 Q-12 42 -14 46" stroke={color} strokeWidth="1.5" strokeOpacity="0.3" fill="none" strokeLinecap="round"/>
      <path d="M52 84 Q48 94 44 102 L52 102 Q54 94 60 88Z" fill="#c8bfb0"/>
      <path d="M78 86 Q76 96 74 102 L82 102 Q82 94 86 90Z" fill="#c8bfb0"/>
      {[42,46,50].map((x,i) => <polygon key={i} points={`${x},102 ${x-2},110 ${x+2},110`} fill="#bfb8a8"/>)}
      {[72,76,80].map((x,i) => <polygon key={i} points={`${x},102 ${x-2},110 ${x+2},110`} fill="#bfb8a8"/>)}
    </svg>
  );
}

// ── DAMAGE FLOAT ──────────────────────────────────────────────────────────────
interface FloatDmg { id: number; x: string; y: string; value: number; crit?: boolean; heal?: boolean; color?: string }
let floatId = 0;

function DamageFloat({ floats }: { floats: FloatDmg[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30 }}>
      {floats.map(f => (
        <div key={f.id} style={{
          position: 'absolute', left: f.x, top: f.y,
          fontFamily: "'Cinzel', serif",
          fontSize: f.crit ? 26 : 20, fontWeight: 900,
          color: f.color || (f.heal ? '#4ade80' : '#fff'),
          textShadow: `0 0 10px ${f.color || '#fff'}, 0 2px 4px rgba(0,0,0,0.8)`,
          animation: 'floatDmg 1.1s ease-out forwards',
          whiteSpace: 'nowrap', letterSpacing: f.crit ? '0.05em' : '0.02em',
          pointerEvents: 'none',
        }}>
          {f.heal ? '+' : ''}{f.value}
          {f.crit && <span style={{ fontSize: 12, marginLeft: 4, color: '#fbbf24' }}>CRIT</span>}
        </div>
      ))}
    </div>
  );
}

// ── TURN ORDER STRIP ──────────────────────────────────────────────────────────
function TurnOrderStrip() {
  const items = [
    { id: 'p0', name: '骸骨騎士', icon: '💀', color: '#8A2BE2', isPlayer: true },
    { id: 'p1', name: '腐乱兵',   icon: '🧟', color: '#22c55e', isPlayer: true },
    { id: 'e1', name: '骨巨人',   icon: '💀', color: '#8A2BE2', isPlayer: false },
    { id: 'p2', name: 'リッチ',   icon: '🧙', color: '#06b6d4', isPlayer: true },
    { id: 'e0', name: '霊体騎士', icon: '⚔',  color: '#06b6d4', isPlayer: false },
    { id: 'e2', name: '死骨竜',   icon: '🐉', color: '#ef4444', isPlayer: false },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 14px', overflowX: 'auto' }}>
      {items.map((item, i) => (
        <div key={item.id} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          animation: `turnChipIn 0.3s ease-out ${i * 0.04}s both`, flexShrink: 0,
        }}>
          <div style={{
            width: i === 0 ? 38 : 28, height: i === 0 ? 38 : 28, borderRadius: '50%',
            background: item.isPlayer ? `radial-gradient(circle, ${item.color}30, #0a0515)` : 'rgba(200,50,50,0.12)',
            border: `${i === 0 ? 2.5 : 1.5}px solid ${i === 0 ? item.color : (item.isPlayer ? item.color + '80' : '#ef444460')}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: i === 0 ? 18 : 13,
            boxShadow: i === 0 ? `0 0 12px ${item.color}80` : 'none',
            transition: 'all 0.3s ease',
          }}>{item.icon}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 7, color: i === 0 ? item.color : '#4a3a5a', letterSpacing: '0.04em' }}>
            {i === 0 ? '▶' : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BATTLE ARENA ──────────────────────────────────────────────────────────────
const POSITIONS: Record<string, React.CSSProperties> = {
  left:   { left: '6%',  width: '30%', alignSelf: 'flex-end', paddingBottom: 12 },
  center: { left: '32%', width: '38%', alignSelf: 'flex-end', paddingBottom: 4  },
  right:  { left: '64%', width: '32%', alignSelf: 'flex-end', paddingBottom: 16 },
};

function BattleArena({ enemies, onTargetEnemy, demonized, flashColor, screenShake }: {
  enemies: EnemyState[];
  onTargetEnemy: (id: number) => void;
  demonized: boolean;
  flashColor: string | null;
  screenShake: boolean;
}) {
  return (
    <div style={{
      position: 'relative', flex: 1,
      background: demonized
        ? 'linear-gradient(180deg, #1a0208 0%, #0d0108 100%)'
        : 'linear-gradient(180deg, #0d0420 0%, #07021a 100%)',
      overflow: 'hidden',
      animation: screenShake ? 'shake 0.4s ease-out' : 'none',
      transition: 'background 0.8s ease',
    }}>
      {/* SVG terrain background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 393 260" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="arenaGlow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor={demonized ? '#3a0810' : '#1a0838'} stopOpacity="0.9"/>
            <stop offset="100%" stopColor={demonized ? '#0d0208' : '#05021a'} stopOpacity="1"/>
          </radialGradient>
        </defs>
        <rect width="393" height="260" fill="url(#arenaGlow)"/>
        <path d="M0 200 Q100 185 200 195 Q300 205 393 190 L393 260 L0 260Z" fill="#0a0520" opacity="0.8"/>
        <path d="M0 210 Q100 198 200 205 Q300 212 393 200 L393 260 L0 260Z" fill="#07031a" opacity="0.9"/>
        <path d="M80 212 Q120 208 160 210 Q200 212 240 208 Q280 205 320 210"
          stroke={demonized ? '#dc2626' : '#8A2BE2'} strokeWidth="1" strokeOpacity="0.3" fill="none"/>
        {[[30,180],[90,160],[150,175],[230,155],[300,165],[360,172]].map(([x,y],i) => (
          <polygon key={i} points={`${x},${y} ${x-35},210 ${x+35},210`} fill="#0d0520" opacity={0.6+i*0.05}/>
        ))}
        {[...Array(20)].map((_,i) => (
          <circle key={i} cx={(i*47+13)%393} cy={(i*31+5)%120} r={0.8+((i*7)%10)/8} fill="#fff" opacity={0.2+((i*3)%8)/20}/>
        ))}
        {demonized && (
          <ellipse cx="196" cy="260" rx="180" ry="60" fill="#dc2626" opacity="0.08"/>
        )}
        {[...Array(10)].map((_,i) => (
          <circle key={i} cx={30+i*38} cy={205+Math.sin(i)*5} r={1.5} fill={demonized ? '#dc2626' : '#8A2BE2'} opacity="0.5"/>
        ))}
      </svg>

      {/* Demonize overlay */}
      {demonized && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center bottom, rgba(220,38,38,0.12), transparent 70%)',
          pointerEvents: 'none',
        }}/>
      )}

      {/* Flash overlay */}
      {flashColor && (
        <div style={{
          position: 'absolute', inset: 0, background: flashColor,
          animation: 'screenFlash 0.5s ease-out forwards', pointerEvents: 'none', zIndex: 25,
        }}/>
      )}

      {/* Enemy sprites */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
        {enemies.filter(e => e.hp > 0).map(enemy => (
          <div key={enemy.id} onClick={() => onTargetEnemy(enemy.id)}
            style={{
              position: 'absolute', ...POSITIONS[enemy.pos],
              cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4,
              transform: `scale(${enemy.size})`, transformOrigin: 'bottom center',
            }}>
            {/* HP bar */}
            <div style={{ width: '100%', height: 5, background: 'rgba(0,0,0,0.5)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', marginBottom: 4 }}>
              <div style={{
                width: `${(enemy.hp / enemy.maxHp) * 100}%`, height: '100%',
                background: enemy.hp / enemy.maxHp > 0.5
                  ? 'linear-gradient(90deg,#22c55e,#4ade80)'
                  : enemy.hp / enemy.maxHp > 0.25
                  ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                  : 'linear-gradient(90deg,#ef4444,#f87171)',
                borderRadius: 3, boxShadow: '0 0 6px rgba(255,255,255,0.3)', transition: 'width 0.5s ease',
              }}/>
            </div>
            {/* Enemy name */}
            <div style={{
              textAlign: 'center', fontFamily: "'Cinzel', serif", fontSize: 8.5, fontWeight: 600,
              color: enemy.targeted ? enemy.color : '#6b5f7a',
              letterSpacing: '0.06em',
              textShadow: enemy.targeted ? `0 0 8px ${enemy.color}` : 'none',
              transition: 'color 0.2s',
            }}>{enemy.name}</div>
            {/* Target marker */}
            {enemy.targeted && (
              <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 14, animation: 'breathe 1s ease-in-out infinite' }}>▼</div>
            )}
            {/* SVG sprite */}
            <div style={{ width: '100%', aspectRatio: '1/1.15' }}>
              {enemy.id === 0 && <WraithKnightSVG hit={enemy.hit} targeted={enemy.targeted} color={enemy.color}/>}
              {enemy.id === 1 && <BoneGiantSVG    hit={enemy.hit} targeted={enemy.targeted} color={enemy.color}/>}
              {enemy.id === 2 && <BoneDragonSVG   hit={enemy.hit} targeted={enemy.targeted} color={enemy.color}/>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BATTLE LOG ────────────────────────────────────────────────────────────────
function BattleLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return (
    <div ref={ref} style={{
      padding: '6px 14px', height: 58,
      background: 'linear-gradient(180deg,rgba(3,1,12,0.6),rgba(5,2,16,0.85))',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2,
    }}>
      {lines.slice(-3).map((line, i) => (
        <div key={i} style={{
          fontFamily: "'Inter', sans-serif", fontSize: 10, lineHeight: 1.4,
          color: i === lines.slice(-3).length - 1 ? '#e2d8f0' : '#6b5f7a',
          animation: i === lines.slice(-3).length - 1 ? 'logFade 0.3s ease-out' : 'none',
        }}>{line}</div>
      ))}
    </div>
  );
}

// ── PARTY STATUS BAR ──────────────────────────────────────────────────────────
interface BattlePartyMember {
  id: string; name: string; icon: string;
  hp: number; maxHp: number; mp: number; maxMp: number;
  color: string; active: boolean;
}

function PartyStatusBar({ party, demonized }: { party: BattlePartyMember[]; demonized: boolean }) {
  return (
    <div style={{
      padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4,
      background: 'rgba(5,2,14,0.85)', borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      {party.map(member => (
        <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: member.hp <= 0 ? 0.35 : 1 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: member.active ? `radial-gradient(circle, ${member.color}30, #0a0515)` : 'rgba(255,255,255,0.04)',
            border: `${member.active ? 2 : 1}px solid ${member.active ? member.color : member.color + '40'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            boxShadow: member.active ? `0 0 10px ${member.color}60` : 'none',
          }}>{member.icon}</div>
          <div style={{ width: 52, flexShrink: 0, fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 600, color: member.active ? '#f0ebff' : '#6b5f7a' }}>
            {member.name}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: '#6b5f7a' }}>HP</div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: '#f87171' }}>
                {member.hp}<span style={{ color: '#4a3a5a', fontSize: 8 }}>/{member.maxHp}</span>
              </div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(member.hp / member.maxHp) * 100}%`, height: '100%',
                background: member.hp / member.maxHp > 0.5 ? 'linear-gradient(90deg,#dc2626,#f87171)'
                  : member.hp / member.maxHp > 0.25 ? '#f59e0b' : '#dc2626',
                borderRadius: 2, transition: 'width 0.4s ease',
              }}/>
            </div>
          </div>
          <div style={{ width: 44, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: '#6b5f7a' }}>MP</div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color: '#60a5fa' }}>{member.mp}</div>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(member.mp / member.maxMp) * 100}%`, height: '100%',
                background: 'linear-gradient(90deg,#1d4ed8,#60a5fa)',
                borderRadius: 2, transition: 'width 0.4s ease',
              }}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SOUL GAUGE ────────────────────────────────────────────────────────────────
function SoulGauge({ value, demonized }: { value: number; demonized: boolean }) {
  const pct = Math.min(100, Math.max(0, value));
  const full = pct >= 100;
  return (
    <div style={{
      padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 10,
      background: demonized ? 'rgba(30,4,4,0.9)' : 'rgba(4,2,14,0.9)',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      transition: 'background 0.6s ease',
    }}>
      <div style={{
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: demonized ? '#dc2626' : '#8A2BE2', letterSpacing: '0.1em', flexShrink: 0,
        textShadow: full ? `0 0 8px ${demonized ? '#dc2626' : '#8A2BE2'}` : 'none',
      }}>☠ SOUL</div>
      <div style={{
        flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden',
        border: `1px solid ${full ? (demonized ? '#dc262660' : '#8A2BE260') : 'rgba(255,255,255,0.08)'}`,
        boxShadow: full ? `0 0 12px ${demonized ? '#dc262680' : '#8A2BE280'}` : 'none',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: demonized
            ? 'linear-gradient(90deg,#7f1d1d,#dc2626,#ef4444)'
            : 'linear-gradient(90deg,#4a0e8a,#8A2BE2,#c084fc,#8A2BE2)',
          backgroundSize: '200% 100%',
          animation: full ? 'soulFill 1.5s linear infinite' : 'none',
          boxShadow: full ? '0 0 10px #8A2BE2' : 'none',
          transition: 'width 0.6s ease',
        }}/>
      </div>
      <div style={{
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: full ? (demonized ? '#dc2626' : '#c084fc') : '#4a3a5a', flexShrink: 0,
      }}>{full ? (demonized ? '解放中' : 'MAX') : `${Math.round(pct)}%`}</div>
    </div>
  );
}

// ── COMMAND BUTTON ─────────────────────────────────────────────────────────────
function CommandButton({ label, sublabel, icon, enabled, color, onClick, glow, demonized }: {
  label: string; sublabel?: string; icon: string; enabled: boolean;
  color: string; onClick: () => void; glow?: boolean; demonized?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={() => { if (!enabled) return; setPressed(true); setTimeout(() => setPressed(false), 150); onClick(); }}
      style={{
        flex: 1, padding: '10px 6px',
        background: !enabled ? `${color}12`
          : pressed ? `${color}35`
          : demonized ? `linear-gradient(135deg,${color}28,${color}12)`
          : `linear-gradient(135deg,${color}22,${color}0e)`,
        border: `1px solid ${enabled ? (glow ? color : color + '60') : color + '35'}`,
        borderRadius: 14, cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.55,
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'all 0.15s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
        boxShadow: glow && enabled ? `0 0 16px ${color}50, inset 0 0 10px ${color}18` : 'none',
        animation: enabled && glow ? 'demonPulse 1.5s ease-in-out infinite' : 'none',
        position: 'relative', overflow: 'hidden',
      }}>
      {enabled && glow && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 14,
          background: `linear-gradient(90deg,transparent,${color}18,transparent)`,
          backgroundSize: '200% 100%', animation: 'shimmer 1.8s infinite',
        }}/>
      )}
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, color: enabled ? '#f0ebff' : `${color}70`, letterSpacing: '0.04em', lineHeight: 1 }}>{label}</div>
      {sublabel && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: enabled ? color + '90' : `${color}45`, letterSpacing: '0.08em' }}>{sublabel}</div>}
    </div>
  );
}

// ── SKILL BUTTON ──────────────────────────────────────────────────────────────
function SkillButton({ skill, mp, onClick, demonized }: {
  skill: typeof SKILLS[0] | typeof DEMON_SKILLS[0]; mp: number;
  onClick: (skill: typeof SKILLS[0] | typeof DEMON_SKILLS[0]) => void;
  demonized: boolean;
}) {
  const canUse = demonized ? true : (('mp' in skill) ? mp >= skill.mp : true);
  return (
    <div onClick={() => canUse && onClick(skill)} style={{
      padding: '10px 8px',
      background: canUse ? 'linear-gradient(135deg,rgba(138,43,226,0.2),rgba(138,43,226,0.08))' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${canUse ? '#8A2BE260' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 12, cursor: canUse ? 'pointer' : 'default',
      opacity: canUse ? 1 : 0.35,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      animation: 'skillReveal 0.25s ease-out both', flex: 1,
    }}>
      <div style={{ fontSize: 22 }}>{skill.icon}</div>
      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700, color: canUse ? '#f0ebff' : '#4a3a5a', textAlign: 'center', lineHeight: 1.2 }}>{skill.name}</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: canUse ? '#60a5fa' : '#2a1a3a', display: 'flex', alignItems: 'center', gap: 2 }}>
        {demonized ? <span style={{ color: '#ef4444' }}>{'cost' in skill ? skill.cost : ''}</span> : `MP ${'mp' in skill ? skill.mp : 0}`}
      </div>
    </div>
  );
}

// ── SYSTEM BAR ────────────────────────────────────────────────────────────────
function SystemBar({ auto, speed, onAuto, onSpeed, onEscape, canEscape }: {
  auto: boolean; speed: number;
  onAuto: () => void; onSpeed: () => void;
  onEscape: () => void; canEscape: boolean;
}) {
  return (
    <div style={{
      paddingTop: 5, paddingLeft: 12, paddingRight: 12,
      paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' as string,
      display: 'flex', gap: 6, alignItems: 'center',
      background: 'rgba(3,1,12,0.9)', borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div onClick={onAuto} style={{
        padding: '5px 10px', borderRadius: 8,
        background: auto ? 'rgba(138,43,226,0.3)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${auto ? '#8A2BE280' : 'rgba(255,255,255,0.08)'}`,
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: auto ? '#c084fc' : '#6b5f7a',
        cursor: 'pointer', letterSpacing: '0.06em',
        boxShadow: auto ? '0 0 10px rgba(138,43,226,0.3)' : 'none',
        transition: 'all 0.2s ease',
      }}>AUTO {auto ? 'ON' : 'OFF'}</div>
      <div onClick={onSpeed} style={{
        padding: '5px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: '#8b7da8', cursor: 'pointer', letterSpacing: '0.06em',
        transition: 'all 0.2s ease',
      }}>×{speed}</div>
      <div style={{ flex: 1 }}/>
      <div onClick={canEscape ? onEscape : undefined} style={{
        padding: '5px 12px', borderRadius: 8,
        background: canEscape ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${canEscape ? '#ef444440' : 'rgba(255,255,255,0.05)'}`,
        fontFamily: "'Cinzel', serif", fontSize: 9, fontWeight: 700,
        color: canEscape ? '#f87171' : '#2a1a3a',
        cursor: canEscape ? 'pointer' : 'default',
        opacity: canEscape ? 1 : 0.4, letterSpacing: '0.06em',
      }}>逃走</div>
    </div>
  );
}

// ── MAIN BATTLE CANVAS ────────────────────────────────────────────────────────
export default function BattleCanvas({ onEnd }: BattleCanvasProps) {
  const { player, party } = useGameStore();

  const [enemies, setEnemies] = useState<EnemyState[]>(INIT_ENEMIES.map(e => ({ ...e })));
  const [soul, setSoul] = useState(45);
  const [phase, setPhase] = useState<'playerTurn' | 'skillMenu' | 'itemMenu' | 'animating' | 'enemyTurn'>('playerTurn');
  const [demonized, setDemonized] = useState(false);
  const [demonTurns, setDemonTurns] = useState(0);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [log, setLog] = useState(['戦闘開始！骸骨山脈の番人たちが立ちはだかる。', '骸骨騎士のターン。コマンドを選択しろ。']);
  const [floats, setFloats] = useState<FloatDmg[]>([]);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [screenShake, setScreenShake] = useState(false);

  const [showResult, setShowResult] = useState(false);
  const [battleResult, setBattleResult] = useState<{ isVictory: boolean; expGained: number; itemsGained: string[]; monstersGained: string[] } | null>(null);

  // Build battle party from store
  const battleParty: BattlePartyMember[] = [
    {
      id: 'player', name: player?.name ?? '骸骨騎士', icon: '💀',
      hp: player?.stats?.hp ?? 820, maxHp: (player?.stats as any)?.maxHp ?? 820,
      mp: player?.stats?.mp ?? 60,  maxMp: (player?.stats as any)?.maxMp ?? 80,
      color: '#8A2BE2', active: true,
    },
    ...party.slice(0, 2).map((m, i): BattlePartyMember => m ? {
      id: m.id, name: m.name, icon: m.tribe === 'UNDEAD' ? '🧟' : '👻',
      hp: m.stats?.hp ?? 580, maxHp: (m.stats as any)?.maxHp ?? m.stats?.hp ?? 580,
      mp: m.stats?.mp ?? 40,  maxMp: (m.stats as any)?.maxMp ?? 60,
      color: ['#22c55e','#06b6d4'][i], active: false,
    } : {
      id: `slot_${i}`, name: `使役魔${i+1}`, icon: '💀',
      hp: 0, maxHp: 100, mp: 0, maxMp: 100, color: '#4a3a5a', active: false,
    }),
  ];

  const speedMs = 900 / speed;
  const currentMp = battleParty[0]?.mp ?? 0;
  const soulFull = soul >= 100;

  const addLog = useCallback((line: string) => setLog(prev => [...prev, line]), []);

  function spawnFloat(x: string, y: string, value: number, opts: Partial<FloatDmg> = {}) {
    const id = ++floatId;
    setFloats(prev => [...prev, { id, x, y, value, ...opts }]);
    setTimeout(() => setFloats(prev => prev.filter(f => f.id !== id)), 1200);
  }

  function doEnemyHit(eid: number) {
    setEnemies(prev => prev.map(e => e.id === eid ? { ...e, hit: true } : e));
    setTimeout(() => setEnemies(prev => prev.map(e => ({ ...e, hit: false }))), 500);
  }

  function damageEnemy(targetId: number, dmg: number, opts: { color?: string } = {}) {
    const isCrit = Math.random() < 0.2;
    const finalDmg = isCrit ? Math.round(dmg * 1.5) : dmg;
    doEnemyHit(targetId);
    const positions: Record<number, { x: string; y: string }> = { 0: { x: '12%', y: '18%' }, 1: { x: '36%', y: '12%' }, 2: { x: '62%', y: '16%' } };
    const pos = positions[targetId] || { x: '40%', y: '15%' };
    spawnFloat(pos.x, pos.y, finalDmg, { crit: isCrit, color: opts.color || '#fff' });
    setEnemies(prev => prev.map(e => e.id === targetId ? { ...e, hp: Math.max(0, e.hp - finalDmg) } : e));
    return finalDmg;
  }

  function getTargetId() {
    const t = enemies.find(e => e.targeted && e.hp > 0);
    return t ? t.id : (enemies.find(e => e.hp > 0)?.id ?? 0);
  }

  function endPlayerTurn() {
    if (demonized) {
      const newTurns = demonTurns - 1;
      if (newTurns <= 0) {
        setDemonized(false);
        setDemonTurns(0);
        addLog('魔神化が解除された。通常形態に戻る。');
      } else {
        setDemonTurns(newTurns);
      }
    }
    setSoul(prev => Math.min(100, prev + (demonized ? -20 : 10)));
    setTimeout(() => runEnemyTurn(), speedMs * 0.4);
  }

  function runEnemyTurn() {
    setPhase('enemyTurn');
    const alive = enemies.filter(e => e.hp > 0);
    if (alive.length === 0) {
      setBattleResult({ isVictory: true, expGained: 800, itemsGained: ['骨の欠片'], monstersGained: [] });
      setShowResult(true);
      return;
    }
    let delay = 0;
    alive.forEach((enemy) => {
      delay += speedMs * 0.55;
      setTimeout(() => {
        const dmg = Math.round(enemy.atk * (0.8 + Math.random() * 0.4));
        spawnFloat('42%', '58%', dmg, { color: '#f87171' });
        addLog(`${enemy.name}の攻撃！ 骸骨騎士に ${dmg}ダメージ！`);
        setFlashColor('rgba(239,68,68,0.25)');
        setTimeout(() => setFlashColor(null), 300);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 450);
      }, delay);
    });
    setTimeout(() => {
      setPhase('playerTurn');
      addLog('骸骨騎士のターン。コマンドを選択しろ。');
    }, delay + speedMs * 0.4);
  }

  function handleAttack() {
    if (phase !== 'playerTurn') return;
    setPhase('animating');
    const tid = getTargetId();
    const enemy = enemies.find(e => e.id === tid);
    const dmg = demonized ? Math.round(1500 * (0.9 + Math.random() * 0.2)) : Math.round(1500 * (0.75 + Math.random() * 0.25));
    addLog(demonized ? `殲滅！ ${enemy?.name}に圧倒的攻撃！` : `骸骨騎士の攻撃！ ${enemy?.name}を狙う！`);
    setTimeout(() => {
      damageEnemy(tid, dmg, { color: demonized ? '#dc2626' : '#f0ebff' });
      if (demonized) { setFlashColor('rgba(220,38,38,0.3)'); setTimeout(() => setFlashColor(null), 350); }
      setTimeout(() => {
        addLog(`${enemy?.name}に ${dmg}ダメージ！`);
        setPhase('playerTurn');
        endPlayerTurn();
      }, speedMs * 0.4);
    }, speedMs * 0.3);
  }

  function handleSkill(skill: typeof SKILLS[0] | typeof DEMON_SKILLS[0]) {
    setPhase('animating');
    const targets = (skill as any).aoe ? enemies.filter(e => e.hp > 0).map(e => e.id) : [getTargetId()];
    addLog(`${demonized ? '魔神技' : '術'}発動！ ${skill.name}！`);
    setFlashColor('rgba(138,43,226,0.3)');
    setTimeout(() => setFlashColor(null), 400);
    setTimeout(() => {
      targets.forEach((tid, i) => {
        setTimeout(() => {
          const dmg = Math.round(skill.power * (0.85 + Math.random() * 0.3));
          damageEnemy(tid, dmg, { color: '#c084fc' });
          addLog(`${enemies.find(e => e.id === tid)?.name}に ${dmg}ダメージ！`);
        }, i * 200);
      });
      setTimeout(() => { setPhase('playerTurn'); endPlayerTurn(); }, targets.length * 200 + speedMs * 0.3);
    }, speedMs * 0.4);
  }

  function handleItem(item: typeof ITEMS[0]) {
    setPhase('animating');
    if (item.effect === 'heal') {
      spawnFloat('42%', '52%', item.value, { heal: true, color: '#4ade80' });
      addLog(`冥界薬を使用！ HP+${item.value}回復！`);
    } else {
      addLog(`エーテルを使用！ MPが全回復！`);
    }
    setTimeout(() => { setPhase('playerTurn'); endPlayerTurn(); }, speedMs * 0.5);
  }

  function handleDemonize() {
    if (!soulFull) return;
    setDemonized(true); setDemonTurns(3); setSoul(100);
    setFlashColor('rgba(180,0,0,0.5)');
    setTimeout(() => setFlashColor(null), 800);
    addLog('☠ 魔神化発動！闇の力が解放される！');
    addLog('全コマンドが魔神専用に切り替わった。3ターン継続。');
    setPhase('playerTurn');
  }

  function handleTargetEnemy(eid: number) {
    if (enemies.find(e => e.id === eid)?.hp === 0) return;
    setEnemies(prev => prev.map(e => ({ ...e, targeted: e.id === eid })));
  }

  // Auto battle
  useEffect(() => {
    if (!auto || phase !== 'playerTurn') return;
    const t = setTimeout(() => handleAttack(), speedMs * 0.4);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, phase]);

  const mainSkills = demonized ? DEMON_SKILLS : SKILLS;

  if (showResult && battleResult) {
    return (
      <ResultScreen
        isVictory={battleResult.isVictory}
        expGained={battleResult.expGained}
        itemsGained={battleResult.itemsGained}
        monstersGained={battleResult.monstersGained}
        onFinish={onEnd}
      />
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#06050f', position: 'relative', overflow: 'hidden',
      fontFamily: "'Inter', sans-serif",
    }} data-demon={demonized ? 'true' : 'false'}>

      {/* ── TOP HUD ── */}
      <div style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        paddingLeft: 12, paddingRight: 12, paddingBottom: 0,
        background: 'linear-gradient(180deg,rgba(3,1,12,0.92),rgba(3,1,12,0.6) 70%,transparent)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#8b7da8' }}>
            <span style={{ fontSize: 13 }}>‹</span>
            <span>マップ</span>
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700,
            color: demonized ? '#ef4444' : '#8A2BE2',
            letterSpacing: '0.12em',
            textShadow: demonized ? '0 0 12px #dc2626' : '0 0 8px #8A2BE2',
            transition: 'all 0.5s ease',
          }}>{demonized ? '☠ 魔神化中' : '骸骨山脈'}</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: phase === 'playerTurn' ? '#22c55e' : phase === 'enemyTurn' ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: phase === 'playerTurn' ? '#22c55e' : phase === 'enemyTurn' ? '#ef4444' : '#f59e0b' }}/>
            {phase === 'playerTurn' ? '自ターン' : phase === 'enemyTurn' ? '敵ターン' : '行動中'}
          </div>
        </div>
        <TurnOrderStrip/>
      </div>

      {/* ── BATTLE ARENA ── */}
      <BattleArena
        enemies={enemies}
        onTargetEnemy={handleTargetEnemy}
        demonized={demonized}
        flashColor={flashColor}
        screenShake={screenShake}
      />

      {/* Damage floats overlay */}
      <DamageFloat floats={floats}/>

      {/* ── BATTLE LOG ── */}
      <BattleLog lines={log}/>

      {/* ── PARTY STATUS ── */}
      <PartyStatusBar party={battleParty} demonized={demonized}/>

      {/* ── SOUL GAUGE ── */}
      <SoulGauge value={soul} demonized={demonized}/>

      {/* ── COMMAND PANEL ── */}
      <div style={{
        padding: '8px 12px',
        background: demonized
          ? 'linear-gradient(180deg,rgba(15,2,2,0.97),rgba(8,1,1,0.99))'
          : 'linear-gradient(180deg,rgba(4,1,14,0.97),rgba(3,1,10,0.99))',
        borderTop: `1px solid ${demonized ? '#dc262630' : 'rgba(255,255,255,0.07)'}`,
        transition: 'background 0.6s ease', zIndex: 10,
      }}>
        {phase === 'skillMenu' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600, color: demonized ? '#ef4444' : '#8A2BE2', letterSpacing: '0.1em' }}>
                {demonized ? '魔神技選択' : '術・スキル選択'}
              </div>
              <div onClick={() => setPhase('playerTurn')} style={{
                padding: '3px 10px', borderRadius: 6,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8', cursor: 'pointer',
              }}>← 戻る</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {mainSkills.map(skill => (
                <SkillButton key={skill.id} skill={skill} mp={currentMp}
                  onClick={(sk) => { setPhase('playerTurn'); handleSkill(sk); }}
                  demonized={demonized}/>
              ))}
            </div>
            <div style={{ marginTop: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8', lineHeight: 1.5 }}>
              スキルを選択してください。長押しで詳細確認。
            </div>
          </div>
        ) : phase === 'itemMenu' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600, color: '#f59e0b', letterSpacing: '0.1em' }}>道具選択</div>
              <div onClick={() => setPhase('playerTurn')} style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8', cursor: 'pointer' }}>← 戻る</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ITEMS.map(item => (
                <div key={item.id} onClick={() => { setPhase('playerTurn'); handleItem(item); }} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, cursor: 'pointer', animation: 'skillReveal 0.2s ease-out',
                }}>
                  <div style={{ fontSize: 18 }}>{item.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, color: '#f0ebff' }}>{item.name}</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#8b7da8' }}>{item.desc}</div>
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#6b5f7a' }}>×{item.count}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, animation: 'commandReveal 0.3s ease-out' }}>
            <CommandButton
              icon={demonized ? '💥' : '⚔'} label={demonized ? '殲滅' : '攻撃'}
              sublabel={demonized ? 'ANNIHILATE' : 'ATTACK'}
              enabled={phase === 'playerTurn'} color={demonized ? '#dc2626' : '#8A2BE2'}
              demonized={demonized} onClick={handleAttack}/>
            <CommandButton
              icon={demonized ? '🔥' : '🔮'} label={demonized ? '魔神技' : '術'}
              sublabel={demonized ? 'DEMON ARTS' : 'SKILL'}
              enabled={phase === 'playerTurn'} color={demonized ? '#dc2626' : '#8A2BE2'}
              demonized={demonized} onClick={() => setPhase('skillMenu')}/>
            <CommandButton
              icon="🧪" label="道具" sublabel="ITEM"
              enabled={phase === 'playerTurn'} color="#f59e0b"
              onClick={() => setPhase('itemMenu')}/>
            <CommandButton
              icon="☠" label={demonized ? `残${demonTurns}T` : '魔神化'}
              sublabel={demonized ? 'DEMONIZED' : soulFull ? 'DEMONIZE' : `SOUL ${Math.round(soul)}%`}
              enabled={soulFull && !demonized} color="#dc2626"
              glow={soulFull && !demonized} demonized={demonized}
              onClick={handleDemonize}/>
          </div>
        )}
      </div>

      {/* ── SYSTEM BAR ── */}
      <SystemBar
        auto={auto} speed={speed}
        onAuto={() => setAuto(a => !a)}
        onSpeed={() => setSpeed(s => s >= 3 ? 1 : s + 1)}
        onEscape={() => { addLog('逃走した。'); onEnd(); }}
        canEscape={true}/>
    </div>
  );
}
