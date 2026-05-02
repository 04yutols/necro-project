'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

interface AreaMapProps {
  onStartStage: (stageId: string) => void;
}

// ── WORLD DATA ─────────────────────────────────────────────────────────────────
const REGIONS = [
  {
    id: 'cradle', name: '亡者の揺り籠', nameEn: 'CRADLE OF THE DEAD',
    x: 188, y: 438, state: 'conquered', element: '闇', difficulty: 1,
    desc: '旅の始まりの地。かつて英雄が倒した死者たちが今や己の軍勢となった。',
    enemies: ['白骨兵 ×8', '死霊犬 ×4'], reward: '骨片 ×20 / 冥石 ×5',
    boss: null, color: '#6b5f7a',
  },
  {
    id: 'rotwood', name: '腐敗の森', nameEn: 'ROTWOOD',
    x: 115, y: 368, state: 'conquered', element: '毒', difficulty: 2,
    desc: '毒の霧が立ち込める古代の森。腐敗した精霊が徘徊する。',
    enemies: ['腐敗エルフ ×6', '毒蜘蛛 ×10'], reward: '毒牙 ×15 / 魔草 ×8',
    boss: '蜘蛛女王 ヴェノム', color: '#22c55e',
  },
  {
    id: 'bones', name: '骸骨山脈', nameEn: 'OSSUARY PEAKS',
    x: 248, y: 300, state: 'current', element: '冥', difficulty: 3,
    desc: '古代巨人の骨が山となった地。峰の頂に強力な骨竜が潜む。',
    enemies: ['骨巨人 ×3', '死骨竜 ×2', '霊体騎士 ×5'], reward: '竜骨 ×5 / 冥結晶 ×12',
    boss: '骨竜王 オッサリウス', color: '#8A2BE2',
  },
  {
    id: 'marsh', name: '血の沼地', nameEn: 'BLOODMIRE',
    x: 148, y: 225, state: 'available', element: '血', difficulty: 4,
    desc: '赤黒い沼が広がる呪われた湿地帯。血の魔族が支配する。',
    enemies: ['血の魔族 ×8', '沼の亡霊 ×6'], reward: '血晶石 ×10 / 呪符 ×6',
    boss: '血女王 クリムゾン', color: '#ef4444',
  },
  {
    id: 'ghostcity', name: '幽霊都市', nameEn: 'PHANTOM CITY',
    x: 265, y: 175, state: 'locked', element: '霊', difficulty: 5,
    desc: 'かつて繁栄した都市の成れの果て。無数の亡霊が彷徨う。',
    enemies: ['???', '???'], reward: '???',
    boss: '???', color: '#06b6d4',
  },
  {
    id: 'tower', name: '死霊の塔', nameEn: 'NECRO SPIRE',
    x: 195, y: 108, state: 'locked', element: '冥', difficulty: 7,
    desc: '古代ネクロマンサーが建てた禁断の塔。強大な死霊が守護する。',
    enemies: ['???', '???'], reward: '???',
    boss: '???', color: '#a855f7',
  },
  {
    id: 'demonking', name: '魔王城', nameEn: "DEMON KING'S KEEP",
    x: 192, y: 42, state: 'locked', element: '魔', difficulty: 10,
    desc: '世界の頂点に君臨する魔王の居城。全てを滅ぼす力が眠る。',
    enemies: ['???'], reward: '魔王の冠',
    boss: '魔王 ダークゾーン', color: '#f59e0b',
  },
] as const;

type Region = typeof REGIONS[number];
type RegionState = Region['state'];

const PATHS: [string, string][] = [
  ['cradle', 'rotwood'], ['cradle', 'bones'],
  ['rotwood', 'marsh'], ['bones', 'marsh'],
  ['marsh', 'ghostcity'], ['bones', 'ghostcity'],
  ['ghostcity', 'tower'], ['tower', 'demonking'],
];

function diffStars(n: number) {
  return '★'.repeat(Math.min(n, 5)) + '☆'.repeat(Math.max(0, 5 - n));
}

// ── TERRAIN ────────────────────────────────────────────────────────────────────
function TerrainLayer() {
  return (
    <g opacity="1">
      <path d="M0 0 L375 0 L375 530 L0 530Z" fill="#05030f"/>
      <path d="M30 480 Q60 420 80 380 Q120 320 100 260 Q85 200 120 160 Q160 110 200 80 Q240 50 300 90 Q340 120 340 180 Q345 230 310 270 Q280 300 290 350 Q300 400 270 440 Q240 470 200 490 Q160 510 120 500 Q70 510 30 480Z"
        fill="#0a0618" opacity="1"/>
      <path d="M120 460 Q150 440 170 420 Q200 400 210 370" stroke="#1a1030" strokeWidth="8" fill="none" opacity="0.8"/>
      <path d="M200 80 Q205 120 215 160 Q220 200 200 230" stroke="#1a1030" strokeWidth="6" fill="none" opacity="0.6"/>
      {([[85,395],[95,380],[72,388],[108,375],[78,402],[92,368],[68,395],[100,390],[82,375],[115,385]] as [number,number][]).map(([x,y],i) => (
        <g key={i}>
          <polygon points={`${x},${y-10} ${x-6},${y} ${x+6},${y}`} fill="#0d2212" opacity="0.9"/>
          <polygon points={`${x},${y-14} ${x-5},${y-4} ${x+5},${y-4}`} fill="#102818" opacity="0.7"/>
          <rect x={x-1.5} y={y} width={3} height={5} fill="#0a1a0a" opacity="0.8"/>
        </g>
      ))}
      {([[260,328],[275,310],[248,318],[288,325],[268,305],[282,298]] as [number,number][]).map(([x,y],i) => (
        <g key={i}>
          <polygon points={`${x},${y-22} ${x-14},${y} ${x+14},${y}`} fill="#1a1228" opacity="0.9"/>
          <polygon points={`${x},${y-22} ${x-5},${y-10} ${x+8},${y-12}`} fill="#2a1a40" opacity="0.5"/>
          <polygon points={`${x},${y-22} ${x-4},${y-14} ${x+4},${y-15}`} fill="#3a2a4e" opacity="0.6"/>
        </g>
      ))}
      <ellipse cx="148" cy="240" rx="45" ry="30" fill="#1a0808" opacity="0.7"/>
      <ellipse cx="138" cy="245" rx="25" ry="15" fill="#2a0808" opacity="0.5"/>
      {([0,1,2,3,4,5]).map(i => (
        <circle key={i} cx={128+i*8} cy={238+Math.sin(i)*8} r={2+1} fill="#3a0808" opacity="0.6"/>
      ))}
      {([[252,185],[262,180],[272,188],[258,175],[268,178],[278,185]] as [number,number][]).map(([x,y],i) => (
        <g key={i} opacity="0.5">
          <rect x={x} y={y} width={8} height={14-i%3*3} fill="#0d1a1a"/>
          <rect x={x+1} y={y+2} width={2} height={3} fill="#1a2a2a"/>
          <rect x={x+5} y={y+2} width={2} height={3} fill="#1a2a2a"/>
        </g>
      ))}
      <rect x="190" y="120" width="10" height="30" fill="#1a0a30" opacity="0.7"/>
      <polygon points="185,120 200,108 215,120" fill="#2a0a40" opacity="0.7"/>
      <rect x="194" y="125" width="3" height="5" fill="#8A2BE2" opacity="0.4"/>
      <rect x="175" y="55" width="34" height="24" fill="#1a0808" opacity="0.8"/>
      <rect x="172" y="52" width="8" height="14" fill="#1a0808" opacity="0.8"/>
      <rect x="202" y="52" width="8" height="14" fill="#1a0808" opacity="0.8"/>
      <rect x="188" y="48" width="6" height="16" fill="#1a0808" opacity="0.8"/>
      <polygon points="175,55 179,47 183,55" fill="#2a0808" opacity="0.7"/>
      <polygon points="204,55 208,47 212,55" fill="#2a0808" opacity="0.7"/>
      <rect x="183" y="60" width="4" height="5" fill="#f59e0b" opacity="0.5"/>
      <rect x="193" y="60" width="4" height="5" fill="#f59e0b" opacity="0.5"/>
      {([0,1,2,3,4,5,6,7]).map(i => (
        <line key={`h${i}`} x1="0" y1={i*70} x2="375" y2={i*70} stroke="#ffffff" strokeWidth="0.3" opacity="0.04"/>
      ))}
      {([0,1,2,3,4,5,6]).map(i => (
        <line key={`v${i}`} x1={i*55} y1="0" x2={i*55} y2="530" stroke="#ffffff" strokeWidth="0.3" opacity="0.04"/>
      ))}
    </g>
  );
}

// ── FOG ────────────────────────────────────────────────────────────────────────
function FogLayer() {
  return (
    <g>
      <ellipse cx="195" cy="105" rx="100" ry="70" fill="#0d0520" opacity="0.82"
        style={{ animation: 'fogDrift 9s ease-in-out infinite' }}/>
      <ellipse cx="220" cy="90" rx="80" ry="55" fill="#120830" opacity="0.6"
        style={{ animation: 'fogDrift 12s ease-in-out infinite 2s' }}/>
      <ellipse cx="170" cy="115" rx="70" ry="45" fill="#0a0418" opacity="0.55"
        style={{ animation: 'fogDrift 7s ease-in-out infinite 4s' }}/>
      <ellipse cx="148" cy="200" rx="70" ry="50" fill="#0d0520" opacity="0.25"
        style={{ animation: 'fogDrift 10s ease-in-out infinite 1s' }}/>
    </g>
  );
}

// ── PATH LINES ─────────────────────────────────────────────────────────────────
function PathLines({ activeId }: { activeId: string | null }) {
  const regionMap = Object.fromEntries(REGIONS.map(r => [r.id, r]));
  return (
    <g>
      {PATHS.map(([fromId, toId], i) => {
        const from = regionMap[fromId];
        const to = regionMap[toId];
        if (!from || !to) return null;
        const bothClear = (from.state === 'conquered' || from.state === 'current') &&
                          (to.state === 'conquered' || to.state === 'current' || to.state === 'available');
        const isActive = activeId === fromId || activeId === toId;
        return (
          <g key={i}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#000" strokeWidth="4" opacity="0.4"/>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={bothClear ? (isActive ? '#c084fc' : '#4a3a6a') : '#1a1228'}
              strokeWidth={isActive ? 2 : 1.5}
              strokeDasharray={bothClear ? 'none' : '4 4'}
              opacity={bothClear ? 0.8 : 0.35}/>
            {bothClear && isActive && (
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke="#c084fc" strokeWidth="3" opacity="0.4"
                strokeDasharray="8 16"
                style={{ animation: 'pathFlow 1.5s linear infinite' }}/>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ── MAP NODE ───────────────────────────────────────────────────────────────────
function MapNode({ region, isActive, onClick }: {
  region: Region; isActive: boolean; onClick: (r: Region) => void;
}) {
  const { x, y, state, color, id } = region;
  const isLocked = state === 'locked';
  const isConquered = state === 'conquered';
  const isCurrent = state === 'current';
  const isAvailable = state === 'available';
  const fillColor = isLocked ? '#1a1228' : isConquered ? '#2a1f3a' : color + '30';
  const strokeColor = isLocked ? '#2a1a3a' : isConquered ? '#4a3a6a' : color;
  const size = isCurrent ? 18 : isAvailable ? 16 : 14;

  return (
    <g onClick={() => !isLocked && onClick(region)} style={{ cursor: isLocked ? 'default' : 'pointer' }}>
      {(isCurrent || isAvailable) && (
        <circle cx={x} cy={y} r={size + 8} fill="none" stroke={color} strokeWidth="1.5" opacity="0"
          style={{ animation: `nodeRing ${isCurrent ? 1.8 : 2.5}s ease-out infinite` }}/>
      )}
      {(isCurrent || isAvailable) && (
        <circle cx={x} cy={y} r={size + 4} fill="none" stroke={color} strokeWidth="1" opacity="0"
          style={{ animation: `nodeRing ${isCurrent ? 1.8 : 2.5}s ease-out infinite 0.4s` }}/>
      )}
      {isActive && (
        <circle cx={x} cy={y} r={size + 12} fill="none" stroke={color} strokeWidth="2" opacity="0.9"/>
      )}
      <circle cx={x} cy={y+3} r={size+2} fill="#000" opacity="0.3"/>
      <circle cx={x} cy={y} r={size}
        fill={fillColor} stroke={strokeColor}
        strokeWidth={isActive ? 2.5 : isCurrent ? 2 : 1.5}
        opacity={isLocked ? 0.5 : 1}/>
      {!isLocked && (
        <circle cx={x-size*0.25} cy={y-size*0.25} r={size*0.35}
          fill={color} opacity={isCurrent ? 0.3 : 0.12}/>
      )}
      {isConquered && (
        <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={color} opacity="0.7">✓</text>
      )}
      {isCurrent && (
        <g style={{ animation: 'currentMarker 2s ease-in-out infinite', transformOrigin: `${x}px ${y}px` }}>
          <polygon points={`${x},${y-size-14} ${x-5},${y-size-6} ${x+5},${y-size-6}`} fill={color} opacity="0.95"/>
          <circle cx={x} cy={y-size-16} r={5} fill={color}/>
          <text x={x} y={y-size-16} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#fff">N</text>
        </g>
      )}
      {isLocked && (
        <text x={x} y={y+1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#4a3a5a" opacity="0.6">🔒</text>
      )}
      <text x={x} y={y + size + 12} textAnchor="middle"
        fontFamily="'Cinzel', serif" fontSize="8.5" fontWeight="600"
        fill={isLocked ? '#3a2a4a' : isConquered ? '#8b7da8' : '#f0ebff'}
        opacity={isLocked ? 0.5 : 1}>
        {region.name}
      </text>
      {!isLocked && (
        <g>
          {Array.from({ length: Math.min(region.difficulty, 5) }).map((_, i) => (
            <circle key={i}
              cx={x - (Math.min(region.difficulty,5)-1)*4 + i*8}
              cy={y + size + 22} r={2}
              fill={isConquered ? '#4a3a6a' : color}
              opacity={isConquered ? 0.5 : 0.9}/>
          ))}
        </g>
      )}
    </g>
  );
}

// ── DETAIL SHEET ───────────────────────────────────────────────────────────────
function DetailSheet({ region, onClose, onEnter }: {
  region: Region; onClose: () => void; onEnter: () => void;
}) {
  const isConquered = region.state === 'conquered';
  const isCurrent = region.state === 'current';

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'linear-gradient(180deg, rgba(10,5,24,0.96) 0%, #0a0518 100%)',
      borderTop: `1px solid ${region.color}50`,
      borderRadius: '24px 24px 0 0',
      padding: '0 0 40px',
      animation: 'sheetReveal 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      boxShadow: `0 -20px 60px ${region.color}20`,
      backdropFilter: 'blur(20px)',
      zIndex: 20,
    }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: `${region.color}50`, margin: '12px auto 0' }}/>

      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 8, color: region.color, letterSpacing: '0.18em' }}>
              {region.nameEn}
            </div>
            <div style={{
              padding: '1px 7px', borderRadius: '4px',
              background: `${region.color}20`, border: `1px solid ${region.color}40`,
              fontFamily: "'Inter', sans-serif", fontSize: 8, color: region.color,
            }}>{region.element}属性</div>
          </div>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, fontWeight: 700, color: '#f0ebff', letterSpacing: '0.03em' }}>
            {region.name}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: region.color + '80', marginTop: 2 }}>
            {diffStars(region.difficulty)} 難易度 {region.difficulty}
          </div>
        </div>
        <div onClick={onClose} style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#8b7da8', fontSize: 14, flexShrink: 0,
        }}>×</div>
      </div>

      <div style={{ height: 1, margin: '12px 20px', background: `linear-gradient(90deg, ${region.color}40, transparent)` }}/>

      <div style={{ padding: '0 20px', fontFamily: "'Inter', sans-serif", fontSize: 11, lineHeight: 1.7, color: '#a89ec8' }}>
        {region.desc}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '12px 20px 0' }}>
        <div style={{
          flex: 1, padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
        }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8, fontWeight: 600, color: '#ef4444', letterSpacing: '0.12em', marginBottom: 6 }}>ENEMIES</div>
          {region.enemies.map((e, i) => (
            <div key={i} style={{
              fontFamily: "'Inter', sans-serif", fontSize: 10,
              color: region.state === 'locked' ? '#3a2a4a' : '#c4b8d8',
              marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }}/>
              {e}
            </div>
          ))}
          {region.boss && (
            <div style={{
              marginTop: 6, padding: '5px 8px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '6px', fontFamily: "'Cinzel', serif", fontSize: 8.5,
              color: region.state === 'locked' ? '#3a2a4a' : '#fca5a5',
            }}>⚠ {region.state === 'locked' ? '???' : region.boss}</div>
          )}
        </div>
        <div style={{
          flex: 1, padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
        }}>
          <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8, fontWeight: 600, color: '#fbbf24', letterSpacing: '0.12em', marginBottom: 6 }}>REWARDS</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: region.state === 'locked' ? '#3a2a4a' : '#fde68a', lineHeight: 1.6 }}>
            {region.reward}
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px 0' }}>
        <div onClick={isConquered ? onClose : onEnter} style={{
          padding: '15px',
          background: isConquered
            ? 'rgba(255,255,255,0.05)'
            : `linear-gradient(135deg, ${region.color}40, ${region.color}20)`,
          border: `1px solid ${isConquered ? 'rgba(255,255,255,0.1)' : region.color + '70'}`,
          borderRadius: '14px', textAlign: 'center', cursor: 'pointer',
          boxShadow: isConquered ? 'none' : `0 4px 24px ${region.color}30`,
          position: 'relative', overflow: 'hidden',
        }}>
          {!isConquered && (
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(90deg, transparent, ${region.color}15, transparent)`,
              backgroundSize: '200% 100%', animation: 'shimmer 2s infinite',
            }}/>
          )}
          <div style={{
            fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700,
            color: isConquered ? '#6b5f7a' : '#f0ebff', letterSpacing: '0.1em',
          }}>
            {isConquered ? '制圧済み — 再挑戦' : isCurrent ? '⚔ 戦闘開始' : '⚔ 侵攻する'}
          </div>
          {!isConquered && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: region.color + '80', marginTop: 3 }}>
              冥力 -20 消費
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PARTICLES ─────────────────────────────────────────────────────────────────
const PARTICLE_DATA = Array.from({ length: 16 }, (_, i) => ({
  left: 10 + ((i * 37 + 13) % 80),
  top: 10 + ((i * 53 + 7) % 80),
  size: 1.5 + (i % 3) * 1,
  color: i % 3 === 0 ? '#8A2BE2' : i % 3 === 1 ? '#c084fc' : '#4a3a6a',
  duration: 3 + (i % 4),
  delay: (i * 0.37) % 5,
}));

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function AreaMap({ onStartStage }: AreaMapProps) {
  const { player, setCurrentTab, party } = useGameStore();
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [meiryoku, setMeiryoku] = useState(80);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setMeiryoku(m => Math.min(100, m + 0.5));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  // 初期スクロール: 骸骨山脈(SVG y=300)を画面中央付近に表示
  useEffect(() => {
    if (!isMounted || !scrollRef.current) return;
    const el = scrollRef.current;
    const svgH = el.clientWidth * (530 / 375);
    // SVG y=300 → pixel位置、TOP_SPACER分オフセット
    const nodeY = TOP_SPACER + (300 / 530) * svgH;
    // 画面高さの40%に合わせる
    const targetScroll = nodeY - el.clientHeight * 0.4;
    el.scrollTop = Math.max(0, targetScroll);
  }, [isMounted]);

  function handleNodeClick(region: Region) {
    setActiveRegion(prev => prev?.id === region.id ? null : region);
  }

  function handleEnter() {
    if (!activeRegion) return;
    const regionId = activeRegion.id;
    setActiveRegion(null);
    setMeiryoku(m => Math.max(0, m - 20));
    onStartStage(regionId);
  }

  if (!isMounted || !player) return null;

  const meiryokuPct = Math.round(meiryoku);

  const partyDisplay = [
    { icon: '💀', name: player.name, color: '#8A2BE2' },
    ...party.slice(0, 2).map((m, i) => m
      ? { icon: '🧟', name: m.name, color: '#22c55e' }
      : { icon: '➕', name: '未配置', color: '#4a3a5a' }
    ),
  ];

  // TOP_SPACER: HUD高さ(ステータスバー54 + コンテンツ~70 + fades) に合わせた最小値
  const TOP_SPACER = 20;
  const BOTTOM_SPACER = 140;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: '#05030f',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
    }}>
      {/* ── スクロール可能なマップ領域 ── */}
      <div ref={scrollRef} style={{
        position: 'absolute', inset: 0,
        overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Top spacer: HUD の下からマップが始まるように */}
        <div style={{ height: TOP_SPACER }} />

        {/* SVG コンテナ: aspect-ratio で 375:530 を維持 */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '375 / 530' }}>
          <svg
            viewBox="0 0 375 530"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="mapGlow" cx="52%" cy="55%" r="55%">
                <stop offset="0%" stopColor="#1a0838" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#03020a" stopOpacity="1"/>
              </radialGradient>
              <filter id="nodeGlow">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="transparent"/>
                <stop offset="100%" stopColor="#03020a" stopOpacity="0.7"/>
              </radialGradient>
            </defs>
            <rect width="375" height="530" fill="url(#mapGlow)"/>
            <TerrainLayer/>
            <PathLines activeId={activeRegion?.id ?? null}/>
            <FogLayer/>
            <g filter="url(#nodeGlow)">
              {REGIONS.map(r => (
                <MapNode key={r.id} region={r} isActive={activeRegion?.id === r.id} onClick={handleNodeClick}/>
              ))}
            </g>
            <rect width="375" height="530" fill="url(#vignette)"/>
          </svg>

          {/* Particles */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {PARTICLE_DATA.map((p, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${p.left}%`, top: `${p.top}%`,
                width: `${p.size}px`, height: `${p.size}px`,
                borderRadius: '50%', background: p.color,
                animation: `particleRise ${p.duration}s ease-out infinite`,
                animationDelay: `${p.delay}s`,
              }}/>
            ))}
          </div>
        </div>

        {/* Bottom spacer: bottom HUD の上にマップが見えるように */}
        <div style={{ height: BOTTOM_SPACER }} />
      </div>

      {/* ── TOP HUD（スクロールしない）── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        paddingLeft: 14, paddingRight: 14, paddingBottom: 16,
        background: 'linear-gradient(180deg, rgba(5,2,16,0.96) 0%, rgba(5,2,16,0.75) 65%, transparent 100%)',
        zIndex: 10,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div onClick={() => setCurrentTab('HOME')} style={{
            display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#8b7da8', marginBottom: 6,
          }}>
            <span style={{ fontSize: 14 }}>‹</span>
            <span>ホーム</span>
          </div>
          <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 8, color: '#8A2BE2', letterSpacing: '0.18em' }}>
            WORLD MAP
          </div>
          <div style={{
            fontFamily: "'Cinzel', serif", fontSize: 18, fontWeight: 700,
            color: '#f0ebff', letterSpacing: '0.04em',
            textShadow: '0 0 20px rgba(138,43,226,0.6)',
          }}>出撃・マップ</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{
            padding: '5px 10px', marginTop: 4,
            background: 'rgba(138,43,226,0.2)', border: '1px solid rgba(138,43,226,0.4)',
            borderRadius: '8px', backdropFilter: 'blur(8px)',
          }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: '#8A2BE2', letterSpacing: '0.1em' }}>現在地</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 700, color: '#c084fc' }}>骸骨山脈</div>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: '10px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 14, backdropFilter: 'blur(8px)',
          }}>🗺</div>
        </div>
      </div>

      {/* ── BOTTOM HUD（スクロールしない）── */}
      {!activeRegion && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          paddingTop: 24, paddingLeft: 14, paddingRight: 14,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          background: 'linear-gradient(0deg, rgba(5,2,16,0.98) 0%, rgba(5,2,16,0.8) 65%, transparent 100%)',
          zIndex: 10, animation: 'fadeIn 0.3s ease-out',
        }}>
          {/* 冥力 bar */}
          <div style={{
            marginBottom: 10, padding: '10px 14px',
            background: 'rgba(5,2,16,0.85)', border: '1px solid rgba(138,43,226,0.3)',
            borderRadius: '14px', backdropFilter: 'blur(12px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 12 }}>💠</div>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, fontWeight: 600, color: '#c084fc', letterSpacing: '0.08em' }}>冥力</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 9, color: '#6b5f7a' }}>NECRO POWER</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                <div style={{
                  fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 700, color: '#c084fc',
                  animation: 'stamRegen 2s ease-in-out infinite',
                }}>{meiryokuPct}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: '#4a3a5a' }}>/ 100</div>
              </div>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(138,43,226,0.2)' }}>
              <div style={{
                width: `${meiryokuPct}%`, height: '100%',
                background: 'linear-gradient(90deg, #4a0e8a, #8A2BE2, #c084fc)',
                borderRadius: 4, boxShadow: '0 0 8px rgba(138,43,226,0.6)',
                transition: 'width 1s ease',
              }}/>
            </div>
          </div>

          {/* Party + 侵攻ボタン */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: 'rgba(5,2,16,0.85)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', backdropFilter: 'blur(12px)',
          }}>
            <div style={{ display: 'flex', gap: 8, flex: 1 }}>
              {partyDisplay.map((m, i) => (
                <div key={i} style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `radial-gradient(circle, ${m.color}20, #0a0515)`,
                  border: `1.5px solid ${m.color}60`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16,
                }}>{m.icon}</div>
              ))}
            </div>
            <div onClick={() => handleNodeClick(REGIONS.find(r => r.state === 'current')!)} style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, rgba(138,43,226,0.4), rgba(88,28,135,0.3))',
              border: '1px solid rgba(138,43,226,0.7)', borderRadius: '12px',
              cursor: 'pointer', boxShadow: '0 0 16px rgba(138,43,226,0.35)',
              flexShrink: 0, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent, rgba(138,43,226,0.15), transparent)',
                backgroundSize: '200% 100%', animation: 'shimmer 2s infinite',
              }}/>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 11, fontWeight: 700, color: '#f0ebff', letterSpacing: '0.06em' }}>侵攻</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 8, color: 'rgba(192,132,252,0.7)', marginTop: 1 }}>ADVANCE</div>
            </div>
          </div>
        </div>
      )}

      {/* ── DETAIL SHEET ── */}
      {activeRegion && (
        <>
          <div onClick={() => setActiveRegion(null)} style={{
            position: 'absolute', inset: 0, zIndex: 15,
            background: 'rgba(0,0,0,0.4)', animation: 'fadeIn 0.2s ease-out',
          }}/>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 16 }}>
            <DetailSheet
              region={activeRegion}
              onClose={() => setActiveRegion(null)}
              onEnter={handleEnter}/>
          </div>
        </>
      )}
    </div>
  );
}
