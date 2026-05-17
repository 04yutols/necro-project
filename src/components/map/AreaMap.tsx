'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Castle, ChevronLeft, Globe2, Home, Lock, MapPin, Skull, Sparkles, Swords } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import stagesData from '../../data/master/stages.json';
import enemiesData from '../../data/master/enemies.json';
import itemsData from '../../data/master/items.json';
import {
  getHiddenDropCount,
  getNextAvailableStage,
  getPrimaryWeaknesses,
  getStageLineSegments,
  getStageList,
  getStageProgressState,
  getStageWaveSummaries,
  getVisibleDropTable,
  type StageProgressState,
} from '../../logic/DungeonSystem';
import type { DropEntry, ElementType, EnemyData, StageData, StageNodeType } from '../../types/game';

interface AreaMapProps {
  onStartStage: (stageId: string) => void;
}

const STAGES = stagesData as Record<string, StageData>;
const ENEMIES = enemiesData as Record<string, EnemyData>;
const ITEMS = itemsData as Record<string, { name?: string; rarity?: string }>;

const VIEWBOX = { width: 375, height: 620 };

const ELEMENT_LABEL: Record<ElementType, string> = {
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

const ELEMENT_COLOR: Record<ElementType, string> = {
  FIRE: '#f97316',
  WATER: '#38bdf8',
  THUNDER: '#facc15',
  EARTH: '#a16207',
  WIND: '#7dd3fc',
  ICE: '#93c5fd',
  LIGHT: '#fde68a',
  DARK: '#8A2BE2',
  NONE: '#a5a9b4',
};

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#a5a9b4',
  R: '#8bda8b',
  RARE: '#38bdf8',
  SR: '#38bdf8',
  EPIC: '#c084fc',
  SSR: '#f5d76e',
  LR: '#fb7185',
  UR: '#ef4444',
};

const MATERIAL_NAME: Record<string, string> = {
  'bone-chip': '骨の欠片',
  'beast-fang': '腐肉獣の牙',
  'ossuary-memory': '竜王の記憶片',
};

type MapLayer = 'WORLD' | 'AREA';
type WorldAreaState = 'CURRENT' | 'AVAILABLE' | 'LOCKED' | 'CLEARED';

interface WorldArea {
  area: number;
  chapter: number;
  nameJa: string;
  nameEn: string;
  description: string;
  color: string;
  position: { x: number; y: number };
  state: WorldAreaState;
  stages: StageData[];
  nextStage: StageData | null;
  clearedCount: number;
  totalCount: number;
}

const WORLD_VIEWBOX = { width: 375, height: 620 };

const WORLD_AREA_META: Record<number, {
  nameEn: string;
  description: string;
  color: string;
  position: { x: number; y: number };
}> = {
  1: {
    nameEn: 'FALLEN ROYAL CAPITAL',
    description: '最初の侵攻領域。墓道、地下牢、竜骨祭壇を制圧し、亡国の中枢へ踏み込む。',
    color: '#8A2BE2',
    position: { x: 152, y: 438 },
  },
  2: {
    nameEn: 'PHANTOM CITY',
    description: '亡国の先に揺らめく幽霊都市。前章の全ノード制圧後に霧が晴れる。',
    color: '#38bdf8',
    position: { x: 250, y: 292 },
  },
};

function buildWorldAreas(
  stages: StageData[],
  clearedStages: string[],
  nextStage: StageData | null,
  states: Record<string, StageProgressState>
): WorldArea[] {
  const grouped = new Map<number, StageData[]>();
  stages.forEach(stage => {
    const list = grouped.get(stage.area) ?? [];
    list.push(stage);
    grouped.set(stage.area, list);
  });

  return [...grouped.entries()].sort((a, b) => a[0] - b[0]).map(([area, areaStages]) => {
    const first = areaStages.find(stage => stage.nodeType !== 'SAFE') ?? areaStages[0];
    const totalStages = areaStages.filter(stage => stage.nodeType !== 'SAFE');
    const clearedCount = totalStages.filter(stage => clearedStages.includes(stage.id)).length;
    const hasAccessibleNode = areaStages.some(stage => states[stage.id] !== 'LOCKED');
    const areaNextStage = nextStage?.area === area ? nextStage : areaStages.find(stage => states[stage.id] === 'AVAILABLE') ?? null;
    const isCleared = totalStages.length > 0 && clearedCount === totalStages.length;
    const meta = WORLD_AREA_META[area] ?? {
      nameEn: `AREA ${area}`,
      description: first.description,
      color: getStageColor(first),
      position: { x: 188, y: 440 - area * 86 },
    };

    let state: WorldAreaState = 'LOCKED';
    if (isCleared) state = 'CLEARED';
    else if (areaNextStage) state = 'CURRENT';
    else if (hasAccessibleNode) state = 'AVAILABLE';

    return {
      area,
      chapter: first.chapter,
      nameJa: first.chapterName,
      nameEn: meta.nameEn,
      description: meta.description,
      color: meta.color,
      position: meta.position,
      state,
      stages: areaStages,
      nextStage: areaNextStage,
      clearedCount,
      totalCount: totalStages.length,
    };
  });
}

function getStageColor(stage: StageData) {
  if (stage.nodeType === 'SAFE') return '#a5a9b4';
  if (stage.nodeType === 'BOSS') return '#ef4444';
  return ELEMENT_COLOR[stage.element] ?? '#8A2BE2';
}

function getStateLabel(state: StageProgressState) {
  if (state === 'SAFE') return '拠点';
  if (state === 'CLEARED') return '制圧済み';
  if (state === 'AVAILABLE') return '挑戦可能';
  return '未解放';
}

function getDropName(drop: DropEntry) {
  if (drop.type === 'RESIDUE') return `${drop.rarity ?? 'RARE'} 深淵の残滓`;
  if (drop.itemId && MATERIAL_NAME[drop.itemId]) return MATERIAL_NAME[drop.itemId];
  if (drop.itemId) return ITEMS[drop.itemId]?.name ?? drop.itemId;
  if (drop.monsterId) return ENEMIES[drop.monsterId]?.nameJa ?? drop.monsterId;
  return drop.rarity ? `${drop.rarity} 報酬` : '未知の報酬';
}

function getDropIcon(drop: DropEntry) {
  if (drop.type === 'RESIDUE') return '◆';
  if (drop.type === 'WEAPON') return '⚔';
  if (drop.type === 'CONSUMABLE') return '🧪';
  if (drop.type === 'MONSTER') return '☠';
  return '▣';
}

function formatRate(rate: number) {
  if (rate >= 1) return '確定';
  if (rate >= 0.01) return `${Math.round(rate * 1000) / 10}%`;
  return '<0.1%';
}

function TerrainLayer() {
  return (
    <g>
      <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="#05030f" />
      <path
        d="M34 564 Q74 514 91 454 Q110 385 83 327 Q63 279 105 228 Q149 175 188 126 Q225 80 286 112 Q338 139 324 212 Q310 284 271 327 Q233 369 243 426 Q253 491 205 542 Q155 596 94 582 Z"
        fill="#0a0618"
      />
      <path d="M188 506 C178 458 180 425 188 390 C203 327 237 306 247 265" stroke="#1e1234" strokeWidth="9" strokeLinecap="round" fill="none" opacity="0.76" />
      <path d="M102 326 C132 306 158 286 188 250 C210 225 229 205 140 182" stroke="#1a1030" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.64" />
      <path d="M247 265 C244 204 226 151 254 94" stroke="#1a1030" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.52" />
      <ellipse cx="145" cy="187" rx="58" ry="34" fill="#210809" opacity="0.72" />
      <ellipse cx="135" cy="194" rx="31" ry="17" fill="#3a0c12" opacity="0.44" />
      {[[226,281], [242,264], [260,282], [254,248], [229,250], [273,268]].map(([x, y], i) => (
        <g key={`peak-${i}`}>
          <polygon points={`${x},${y - 32} ${x - 20},${y} ${x + 20},${y}`} fill="#21142e" opacity="0.92" />
          <polygon points={`${x},${y - 32} ${x - 7},${y - 14} ${x + 8},${y - 15}`} fill="#4c335e" opacity="0.45" />
        </g>
      ))}
      {[[80,376], [92,362], [70,358], [111,344], [95,333], [72,329], [121,319], [105,305]].map(([x, y], i) => (
        <g key={`grave-${i}`} opacity="0.78">
          <path d={`M${x - 5} ${y} L${x - 4} ${y - 12} Q${x} ${y - 18} ${x + 4} ${y - 12} L${x + 5} ${y}Z`} fill="#171221" stroke="#463353" strokeWidth="0.8" />
          <line x1={x - 3} y1={y - 6} x2={x + 3} y2={y - 6} stroke="#6b5f7a" strokeWidth="0.5" opacity="0.4" />
        </g>
      ))}
      {[[248,112], [259,105], [270,113], [238,96], [283,98]].map(([x, y], i) => (
        <g key={`ghost-city-${i}`} opacity="0.4">
          <rect x={x} y={y} width="9" height={22 - (i % 3) * 4} fill="#102025" />
          <rect x={x + 2} y={y + 4} width="2" height="4" fill="#38bdf8" opacity="0.35" />
        </g>
      ))}
      {Array.from({ length: 24 }, (_, i) => (
        <circle
          key={`star-${i}`}
          cx={(i * 47 + 18) % VIEWBOX.width}
          cy={(i * 31 + 20) % 250}
          r={0.7 + (i % 3) * 0.45}
          fill="#fff"
          opacity={0.08 + (i % 5) * 0.035}
        />
      ))}
      <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#mapVignette)" />
    </g>
  );
}

function ParticleLayer() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 18 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${8 + ((i * 37 + 11) % 84)}%`,
            top: `${8 + ((i * 53 + 7) % 78)}%`,
            width: 1.6 + (i % 3),
            height: 1.6 + (i % 3),
            borderRadius: '50%',
            background: i % 4 === 0 ? '#ef4444' : i % 3 === 0 ? '#8A2BE2' : '#c084fc',
            opacity: 0.65,
            animation: `particleRise ${3 + (i % 4)}s ease-out infinite`,
            animationDelay: `${(i * 0.31) % 4}s`,
          }}
        />
      ))}
    </div>
  );
}

function PathLines({ stages, activeStageId, states }: { stages: StageData[]; activeStageId: string | null; states: Record<string, StageProgressState> }) {
  const segments = useMemo(() => {
    const stageMap = Object.fromEntries(stages.map(stage => [stage.id, stage]));
    const base = getStageLineSegments(stageMap);
    const safe = stages.find(stage => stage.nodeType === 'SAFE');
    const first = stages.find(stage => stage.nodeType !== 'SAFE' && stage.unlockRequires.length === 0);
    return safe && first ? [{ from: safe, to: first }, ...base] : base;
  }, [stages]);

  return (
    <g>
      {segments.map(({ from, to }) => {
        const fromColor = getStageColor(from);
        const toColor = getStageColor(to);
        const fromDone = states[from.id] === 'CLEARED' || states[from.id] === 'SAFE';
        const toAvailable = states[to.id] === 'AVAILABLE' || states[to.id] === 'CLEARED';
        const isLive = fromDone && toAvailable;
        const isActive = activeStageId === from.id || activeStageId === to.id;
        return (
          <g key={`${from.id}-${to.id}`}>
            <line x1={from.position.x} y1={from.position.y} x2={to.position.x} y2={to.position.y} stroke="#000" strokeWidth="6" opacity="0.35" />
            <line
              x1={from.position.x}
              y1={from.position.y}
              x2={to.position.x}
              y2={to.position.y}
              stroke={isLive ? (isActive ? toColor : '#5b4a74') : '#21162c'}
              strokeWidth={isActive ? 3 : 1.6}
              strokeDasharray={isLive ? 'none' : '5 7'}
              opacity={isLive ? 0.85 : 0.42}
            />
            {isLive && isActive && (
              <line
                x1={from.position.x}
                y1={from.position.y}
                x2={to.position.x}
                y2={to.position.y}
                stroke={fromColor}
                strokeWidth="4"
                opacity="0.28"
                strokeDasharray="8 16"
                style={{ animation: 'pathFlow 1.5s linear infinite' }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function MapNode({
  stage,
  state,
  isActive,
  isRevealing = false,
  onClick,
}: {
  stage: StageData;
  state: StageProgressState;
  isActive: boolean;
  isRevealing?: boolean;
  onClick: (stage: StageData) => void;
}) {
  const color = getStageColor(stage);
  const isLocked = state === 'LOCKED';
  const isBoss = stage.nodeType === 'BOSS';
  const size = stage.nodeType === 'SAFE' ? 15 : isBoss ? 20 : 17;
  const fill = isLocked ? '#171020' : state === 'CLEARED' ? '#1f1730' : `${color}32`;
  const stroke = isLocked ? '#35233d' : state === 'CLEARED' ? '#7b688d' : color;
  const glyph = stage.nodeType === 'SAFE' ? '⌂' : isBoss ? '☠' : state === 'LOCKED' ? '×' : '⚔';

  return (
    <g onClick={() => onClick(stage)} style={{ cursor: 'pointer' }}>
      {(state === 'AVAILABLE' || isActive) && !isLocked && (
        <>
          <circle cx={stage.position.x} cy={stage.position.y} r={size + 10} fill="none" stroke={color} strokeWidth="1.2" opacity="0" style={{ animation: 'nodeRing 2.2s ease-out infinite' }} />
          <circle cx={stage.position.x} cy={stage.position.y} r={size + 5} fill="none" stroke={color} strokeWidth="1" opacity="0" style={{ animation: 'nodeRing 2.2s ease-out infinite 0.35s' }} />
        </>
      )}
      {isRevealing && !isLocked && (
        <>
          <circle cx={stage.position.x} cy={stage.position.y} r={size + 18} fill={color} opacity="0.12" style={{ animation: 'mapUnlockPulse 1.4s ease-out infinite' }} />
          {Array.from({ length: 8 }, (_, i) => (
            <circle
              key={`fog-shard-${i}`}
              cx={stage.position.x + Math.cos((i / 8) * Math.PI * 2) * (size + 16)}
              cy={stage.position.y + Math.sin((i / 8) * Math.PI * 2) * (size + 16)}
              r="2"
              fill={color}
              opacity="0.72"
              style={{ animation: `fogShardDissolve ${1.1 + (i % 3) * 0.12}s ease-out infinite`, animationDelay: `${i * 0.06}s` }}
            />
          ))}
        </>
      )}
      <circle cx={stage.position.x} cy={stage.position.y + 4} r={size + 3} fill="#000" opacity="0.36" />
      <circle
        cx={stage.position.x}
        cy={stage.position.y}
        r={size}
        fill={fill}
        stroke={isActive ? '#f0ebff' : stroke}
        strokeWidth={isActive ? 2.6 : isBoss ? 2.2 : 1.6}
        opacity={isLocked ? 0.58 : 1}
      />
      {!isLocked && (
        <circle cx={stage.position.x - size * 0.24} cy={stage.position.y - size * 0.25} r={size * 0.34} fill={color} opacity={state === 'CLEARED' ? 0.14 : 0.33} />
      )}
      <text
        x={stage.position.x}
        y={stage.position.y + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={stage.nodeType === 'SAFE' ? 13 : isBoss ? 14 : 12}
        fill={isLocked ? '#5d5069' : state === 'CLEARED' ? '#c7bde0' : '#fff'}
      >
        {state === 'CLEARED' ? '✓' : glyph}
      </text>
      <text
        x={stage.position.x}
        y={stage.position.y + size + 15}
        textAnchor="middle"
        fontFamily="'Cinzel', serif"
        fontSize="8.2"
        fontWeight="700"
        fill={isLocked ? '#51445c' : '#f0ebff'}
        opacity={isLocked ? 0.66 : 1}
      >
        {stage.nameJa}
      </text>
      {stage.difficulty > 0 && (
        <g>
          {Array.from({ length: Math.min(stage.difficulty, 5) }, (_, i) => (
            <circle
              key={i}
              cx={stage.position.x - (Math.min(stage.difficulty, 5) - 1) * 3.6 + i * 7.2}
              cy={stage.position.y + size + 25}
              r="1.8"
              fill={isLocked ? '#51445c' : color}
              opacity={state === 'CLEARED' ? 0.52 : 0.9}
            />
          ))}
        </g>
      )}
    </g>
  );
}

function StageTypeIcon({ nodeType }: { nodeType: StageNodeType }) {
  if (nodeType === 'SAFE') return <Home size={14} />;
  if (nodeType === 'BOSS') return <Skull size={14} />;
  return <Swords size={14} />;
}

function HeaderStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '7px 9px',
      borderRadius: 10,
      background: 'rgba(255,255,255,0.055)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(14px)',
      minWidth: 0,
    }}>
      <div style={{ color: '#c084fc', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 7, color: '#6b5f7a', letterSpacing: '0.13em', fontWeight: 800 }}>{label}</div>
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, color: '#f0ebff', fontWeight: 800, whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  );
}

function WorldTerrainLayer() {
  return (
    <g>
      <rect width={WORLD_VIEWBOX.width} height={WORLD_VIEWBOX.height} fill="#05030f" />
      <path
        d="M24 532 C82 474 61 402 111 350 C162 296 138 237 186 187 C232 139 285 151 332 92 L375 0 L375 620 L0 620 Z"
        fill="#090616"
        opacity="0.95"
      />
      <path
        d="M42 492 C93 438 88 387 132 343 C182 292 164 232 206 190 C246 150 281 141 318 105"
        stroke="#211631"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
        opacity="0.72"
      />
      <path
        d="M152 438 C181 392 210 343 250 292"
        stroke="#37224d"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M250 292 C274 241 292 190 318 105"
        stroke="#1c2d3a"
        strokeWidth="4"
        strokeDasharray="9 12"
        strokeLinecap="round"
        fill="none"
        opacity="0.48"
      />
      <ellipse cx="152" cy="438" rx="84" ry="52" fill="#170726" opacity="0.76" />
      <ellipse cx="250" cy="292" rx="72" ry="46" fill="#071a25" opacity="0.52" />
      <ellipse cx="315" cy="105" rx="66" ry="42" fill="#25100d" opacity="0.34" />
      {Array.from({ length: 32 }, (_, i) => (
        <circle
          key={`world-star-${i}`}
          cx={(i * 43 + 18) % WORLD_VIEWBOX.width}
          cy={(i * 67 + 24) % WORLD_VIEWBOX.height}
          r={0.7 + (i % 3) * 0.42}
          fill={i % 4 === 0 ? '#8A2BE2' : '#fff'}
          opacity={0.08 + (i % 6) * 0.032}
        />
      ))}
      <rect width={WORLD_VIEWBOX.width} height={WORLD_VIEWBOX.height} fill="url(#worldVignette)" />
    </g>
  );
}

function WorldAreaNode({
  area,
  isActive,
  onClick,
}: {
  area: WorldArea;
  isActive: boolean;
  onClick: (area: WorldArea) => void;
}) {
  const locked = area.state === 'LOCKED';
  const cleared = area.state === 'CLEARED';
  const current = area.state === 'CURRENT';
  const color = area.color;
  const size = current ? 24 : 21;
  const fill = locked ? '#15101c' : cleared ? '#1e1830' : `${color}2e`;
  const stroke = locked ? '#3a3042' : cleared ? '#b6a4c9' : color;

  return (
    <g onClick={() => onClick(area)} style={{ cursor: 'pointer' }}>
      {current && (
        <>
          <circle cx={area.position.x} cy={area.position.y} r={size + 15} fill="none" stroke={color} strokeWidth="1.4" opacity="0" style={{ animation: 'nodeRing 2.4s ease-out infinite' }} />
          <circle cx={area.position.x} cy={area.position.y} r={size + 8} fill="none" stroke={color} strokeWidth="1" opacity="0" style={{ animation: 'nodeRing 2.4s ease-out infinite 0.42s' }} />
        </>
      )}
      <circle cx={area.position.x} cy={area.position.y + 5} r={size + 4} fill="#000" opacity="0.42" />
      <circle
        cx={area.position.x}
        cy={area.position.y}
        r={size}
        fill={fill}
        stroke={isActive ? '#f0ebff' : stroke}
        strokeWidth={isActive ? 2.8 : 2}
        opacity={locked ? 0.62 : 1}
      />
      {!locked && (
        <circle cx={area.position.x - 6} cy={area.position.y - 7} r="7" fill={color} opacity={current ? 0.36 : 0.18} />
      )}
      <text
        x={area.position.x}
        y={area.position.y + 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="15"
        fill={locked ? '#5f5368' : '#fff'}
      >
        {locked ? '×' : cleared ? '✓' : '◆'}
      </text>
      <text
        x={area.position.x}
        y={area.position.y + size + 17}
        textAnchor="middle"
        fontFamily="'Cinzel', serif"
        fontSize="9"
        fontWeight="900"
        fill={locked ? '#5b4f64' : '#f0ebff'}
      >
        第{area.chapter}章
      </text>
      <text
        x={area.position.x}
        y={area.position.y + size + 30}
        textAnchor="middle"
        fontFamily="'Noto Sans JP', sans-serif"
        fontSize="10"
        fontWeight="800"
        fill={locked ? '#51445c' : color}
      >
        {area.nameJa}
      </text>
    </g>
  );
}

function WorldAreaSheet({
  area,
  onClose,
  onEnter,
}: {
  area: WorldArea;
  onClose: () => void;
  onEnter: () => void;
}) {
  const locked = area.state === 'LOCKED';
  const label = area.state === 'CLEARED' ? '再訪する' : locked ? '未解放' : 'エリアマップへ';

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: 'min(58dvh, 430px)',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, rgba(10,5,24,0.97), #07030f 100%)',
      borderTop: `1px solid ${area.color}55`,
      borderRadius: '22px 22px 0 0',
      boxShadow: `0 -22px 70px ${area.color}24`,
      backdropFilter: 'blur(22px)',
      animation: 'sheetReveal 0.32s cubic-bezier(0.34,1.18,0.64,1)',
    }}>
      <div style={{ width: 40, height: 4, borderRadius: 999, background: `${area.color}55`, margin: '10px auto 0', flexShrink: 0 }} />
      <div style={{ padding: '14px 18px 10px', minHeight: 0, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 7 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: area.color,
                fontFamily: "'Cinzel', serif",
                fontSize: 8,
                letterSpacing: '0.16em',
                fontWeight: 900,
              }}>
                <Globe2 size={14} />
                {area.nameEn}
              </span>
              <span style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: `${area.color}18`,
                border: `1px solid ${area.color}40`,
                color: area.color,
                fontSize: 8,
                fontWeight: 900,
              }}>
                {area.state === 'CURRENT' ? '侵攻中' : area.state === 'CLEARED' ? '制圧済み' : area.state === 'AVAILABLE' ? '解放済み' : '未解放'}
              </span>
            </div>
            <div style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(21px, 6vw, 27px)',
              lineHeight: 1.08,
              color: '#f0ebff',
              fontWeight: 900,
              letterSpacing: '0.03em',
              textShadow: `0 0 20px ${area.color}55`,
            }}>
              {area.nameJa}
            </div>
            <div style={{ marginTop: 8, fontSize: 10.5, lineHeight: 1.6, color: '#a89ec8' }}>{area.description}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.055)',
              color: '#8b7da8',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <div style={infoPanelStyle}>
            <div style={panelTitleStyle}>AREA PROGRESS</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 20, color: area.color, fontWeight: 900 }}>
              {area.clearedCount}<span style={{ color: '#5a4c66', fontSize: 12 }}> / {area.totalCount}</span>
            </div>
            <div style={{ marginTop: 3, fontSize: 9, color: '#7c708d' }}>DUNGEON NODES</div>
          </div>
          <div style={infoPanelStyle}>
            <div style={panelTitleStyle}>NEXT OBJECTIVE</div>
            <div style={{ fontSize: 10.5, color: '#ded6ef', lineHeight: 1.45 }}>
              {area.nextStage ? area.nextStage.nameJa : locked ? '前章の霧を晴らす' : '全ノード制圧済み'}
            </div>
            <div style={{ marginTop: 4, fontSize: 8.5, color: area.color }}>{area.nextStage ? 'Layer 2で選択' : 'WORLD STATUS'}</div>
          </div>
        </div>
      </div>

      <div style={{
        padding: '10px 18px max(16px, env(safe-area-inset-bottom, 16px))',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <button
          type="button"
          disabled={locked}
          onClick={onEnter}
          style={{
            width: '100%',
            minHeight: 48,
            borderRadius: 14,
            border: `1px solid ${locked ? 'rgba(255,255,255,0.09)' : `${area.color}72`}`,
            background: locked
              ? 'rgba(255,255,255,0.045)'
              : `linear-gradient(135deg, ${area.color}42, rgba(6,3,16,0.94))`,
            boxShadow: locked ? 'none' : `0 0 24px ${area.color}2f`,
            color: locked ? '#52465e' : '#f0ebff',
            fontFamily: "'Cinzel', serif",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.12em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            opacity: locked ? 0.65 : 1,
          }}
        >
          {locked ? <Lock size={15} /> : <MapPin size={15} />}
          {label}
        </button>
      </div>
    </div>
  );
}

function WavePreview({ stage }: { stage: StageData }) {
  const waves = getStageWaveSummaries(stage, ENEMIES);
  if (stage.nodeType === 'SAFE') {
    return (
      <div style={infoPanelStyle}>
        <div style={panelTitleStyle}>CAMP</div>
        <div style={{ fontSize: 10, color: '#a89ec8', lineHeight: 1.55 }}>戦闘なし。拠点で装備・転職・軍団編成を整える。</div>
      </div>
    );
  }

  return (
    <div style={infoPanelStyle}>
      <div style={panelTitleStyle}>WAVE STRUCTURE</div>
      <div style={{ display: 'grid', gap: 7 }}>
        {waves.map(wave => {
          const color = wave.role === 'BOSS' ? '#ef4444' : wave.role === 'SHIELD' ? '#38bdf8' : '#8A2BE2';
          return (
            <div key={wave.label} style={{
              display: 'grid',
              gridTemplateColumns: '54px 1fr',
              gap: 8,
              alignItems: 'center',
              padding: '7px 8px',
              borderRadius: 8,
              background: `${color}0f`,
              border: `1px solid ${color}30`,
            }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 8.5, color, fontWeight: 900 }}>{wave.label}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {wave.enemies.map(enemy => (
                    <span key={enemy.id} style={{
                      fontSize: 9,
                      color: '#ded6ef',
                      whiteSpace: 'nowrap',
                    }}>
                      {enemy.tier === 'BOSS' ? '☠' : enemy.tier === 'ELITE' ? '◆' : '•'} {enemy.nameJa}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 2, fontSize: 8.5, color: '#6b5f7a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wave.intent}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const infoPanelStyle: CSSProperties = {
  padding: '10px 11px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.08)',
  minWidth: 0,
};

const panelTitleStyle: CSSProperties = {
  fontFamily: "'Cinzel', serif",
  fontSize: 8,
  fontWeight: 900,
  color: '#8A2BE2',
  letterSpacing: '0.13em',
  marginBottom: 7,
};

function WeaknessPreview({ stage }: { stage: StageData }) {
  const weaknesses = getPrimaryWeaknesses(stage, ENEMIES);
  return (
    <div style={infoPanelStyle}>
      <div style={panelTitleStyle}>WEAKNESS</div>
      {weaknesses.length === 0 ? (
        <div style={{ fontSize: 10, color: '#6b5f7a' }}>なし</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {weaknesses.map(element => (
            <span key={element} style={{
              padding: '5px 8px',
              borderRadius: 999,
              background: `${ELEMENT_COLOR[element]}18`,
              border: `1px solid ${ELEMENT_COLOR[element]}55`,
              color: ELEMENT_COLOR[element],
              fontSize: 10,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}>
              {ELEMENT_LABEL[element]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DropPreview({ stage }: { stage: StageData }) {
  const visibleDrops = getVisibleDropTable(stage, ENEMIES).slice(0, 5);
  const hiddenCount = getHiddenDropCount(stage, ENEMIES);

  return (
    <div style={infoPanelStyle}>
      <div style={panelTitleStyle}>DROPS</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {visibleDrops.length === 0 ? (
          <div style={{ fontSize: 10, color: '#6b5f7a' }}>報酬なし</div>
        ) : visibleDrops.map(drop => {
          const rarity = drop.rarity ?? 'COMMON';
          const color = RARITY_COLOR[rarity] ?? '#a5a9b4';
          return (
            <div key={`${drop.itemId ?? drop.monsterId ?? drop.type}-${rarity}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                color,
                background: `${color}12`,
                border: `1px solid ${color}35`,
                flexShrink: 0,
                fontSize: 12,
              }}>{getDropIcon(drop)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 10, color: '#ded6ef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDropName(drop)}</div>
                <div style={{ fontSize: 8, color }}>{rarity} / {formatRate(drop.rate)}</div>
              </div>
            </div>
          );
        })}
        {hiddenCount > 0 && (
          <div style={{
            marginTop: 2,
            padding: '7px 9px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(127,29,29,0.22), rgba(5,2,16,0.8))',
            border: '1px solid rgba(239,68,68,0.32)',
            color: '#fca5a5',
            fontSize: 9,
            lineHeight: 1.35,
          }}>
            ?? 理外の呪装が眠っている。通常プレビューでは詳細不明。
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSheet({
  stage,
  state,
  onClose,
  onEnter,
  onGoHome,
}: {
  stage: StageData;
  state: StageProgressState;
  onClose: () => void;
  onEnter: () => void;
  onGoHome: () => void;
}) {
  const color = getStageColor(stage);
  const isLocked = state === 'LOCKED';
  const isCleared = state === 'CLEARED';
  const buttonLabel = stage.nodeType === 'SAFE' ? '拠点へ戻る' : isCleared ? '再挑戦' : isLocked ? '未解放' : '侵攻開始';

  return (
    <div style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: 'min(72dvh, 560px)',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, rgba(10,5,24,0.97), #080411 100%)',
      borderTop: `1px solid ${color}55`,
      borderRadius: '22px 22px 0 0',
      boxShadow: `0 -22px 70px ${color}24`,
      backdropFilter: 'blur(22px)',
      animation: 'sheetReveal 0.32s cubic-bezier(0.34,1.18,0.64,1)',
    }}>
      <div style={{ width: 40, height: 4, borderRadius: 999, background: `${color}55`, margin: '10px auto 0', flexShrink: 0 }} />
      <div style={{ padding: '12px 18px 10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                color,
                fontFamily: "'Cinzel', serif",
                fontSize: 8,
                letterSpacing: '0.16em',
                fontWeight: 900,
              }}>
                <StageTypeIcon nodeType={stage.nodeType} />
                {stage.nameEn}
              </div>
              <span style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: `${color}18`,
                border: `1px solid ${color}40`,
                color,
                fontSize: 8,
                fontWeight: 900,
              }}>{getStateLabel(state)}</span>
              {stage.nodeType !== 'SAFE' && (
                <span style={{ fontSize: 8, color: '#6b5f7a', fontWeight: 800 }}>3 WAVE / STAMINA FREE</span>
              )}
            </div>
            <div style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(18px, 5vw, 24px)',
              lineHeight: 1.12,
              color: '#f0ebff',
              fontWeight: 900,
              letterSpacing: '0.03em',
              textShadow: `0 0 18px ${color}55`,
            }}>{stage.nameJa}</div>
            <div style={{ marginTop: 6, fontSize: 10.5, lineHeight: 1.55, color: '#a89ec8' }}>{stage.description}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.055)',
              color: '#8b7da8',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      </div>

      <div className="safe-scroll" style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0 18px 12px',
        display: 'grid',
        gap: 10,
        minHeight: 0,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <WeaknessPreview stage={stage} />
          <DropPreview stage={stage} />
        </div>
        <WavePreview stage={stage} />
      </div>

      <div style={{
        padding: '10px 18px max(16px, env(safe-area-inset-bottom, 16px))',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <button
          type="button"
          disabled={isLocked}
          onClick={stage.nodeType === 'SAFE' ? onGoHome : onEnter}
          style={{
            width: '100%',
            minHeight: 48,
            borderRadius: 14,
            border: `1px solid ${isLocked ? 'rgba(255,255,255,0.09)' : `${color}72`}`,
            background: isLocked
              ? 'rgba(255,255,255,0.045)'
              : `linear-gradient(135deg, ${color}42, rgba(6,3,16,0.94))`,
            boxShadow: isLocked ? 'none' : `0 0 24px ${color}2f`,
            color: isLocked ? '#52465e' : '#f0ebff',
            fontFamily: "'Cinzel', serif",
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: '0.12em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            opacity: isLocked ? 0.65 : 1,
          }}
        >
          {isLocked ? <Lock size={15} /> : stage.nodeType === 'SAFE' ? <Home size={15} /> : <Swords size={15} />}
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function FogRevealOverlay({ stage, onDone }: { stage: StageData; onDone: () => void }) {
  const color = getStageColor(stage);

  useEffect(() => {
    const timer = window.setTimeout(onDone, 1900);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 48%, transparent 0 19%, rgba(5,2,16,0.24) 31%, rgba(5,2,16,0.68) 100%)',
        animation: 'mapFogReveal 1.8s ease-out both',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-20%',
          backgroundImage: `radial-gradient(circle at 42% 44%, ${color}36, transparent 17%), radial-gradient(circle at 58% 48%, rgba(255,255,255,0.12), transparent 15%), repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0 2px, transparent 2px 22px)`,
          filter: 'blur(1.4px)',
          animation: 'fogRuneSweep 1.65s ease-out both',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          width: 'min(68vw, 260px)',
          height: 'min(68vw, 260px)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          border: `1px solid ${color}80`,
          boxShadow: `0 0 44px ${color}55, inset 0 0 32px rgba(255,255,255,0.06)`,
          animation: 'mapUnlockPulse 1.25s ease-out both',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 'max(26px, env(safe-area-inset-bottom, 26px))',
          borderRadius: 18,
          border: `1px solid ${color}66`,
          background: 'linear-gradient(180deg, rgba(10,4,24,0.94), rgba(5,2,16,0.94))',
          boxShadow: `0 0 28px ${color}30`,
          padding: '13px 15px',
          animation: 'mapUnlockBanner 1.6s cubic-bezier(0.2,1,0.28,1) both',
        }}
      >
        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 9, color, fontWeight: 900, letterSpacing: '0.16em' }}>FOG CLEARED</div>
        <div style={{ marginTop: 4, fontFamily: "'Noto Sans JP', sans-serif", fontSize: 15, color: '#f0ebff', fontWeight: 900 }}>{stage.nameJa}</div>
        <div style={{ marginTop: 3, fontSize: 10, color: '#a89ec8' }}>新たな深淵の迷宮ノードが解放された</div>
      </div>
    </div>
  );
}

export default function AreaMap({ onStartStage }: AreaMapProps) {
  const { player, party, setCurrentTab } = useGameStore();
  const [layer, setLayer] = useState<MapLayer>('WORLD');
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [activeWorldAreaId, setActiveWorldAreaId] = useState<number | null>(null);
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [fogRevealStageId, setFogRevealStageId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allStages = useMemo(() => getStageList(STAGES), []);
  const clearedStages = player?.clearedStages ?? [];
  const states = useMemo(() => Object.fromEntries(allStages.map(stage => [stage.id, getStageProgressState(stage, clearedStages)])), [clearedStages, allStages]);
  const nextStage = useMemo(() => getNextAvailableStage(STAGES, clearedStages), [clearedStages]);
  const worldAreas = useMemo(() => buildWorldAreas(allStages, clearedStages, nextStage, states), [allStages, clearedStages, nextStage, states]);
  const activeWorldArea = activeWorldAreaId ? worldAreas.find(area => area.area === activeWorldAreaId) ?? null : null;
  const selectedAreaId = selectedArea ?? nextStage?.area ?? worldAreas[0]?.area ?? 1;
  const selectedWorldArea = worldAreas.find(area => area.area === selectedAreaId) ?? worldAreas[0] ?? null;
  const areaStages = useMemo(() => allStages.filter(stage => stage.area === selectedAreaId), [allStages, selectedAreaId]);
  const nextStageForArea = useMemo(() => areaStages.find(stage => states[stage.id] === 'AVAILABLE') ?? null, [areaStages, states]);
  const activeStage = activeStageId ? STAGES[activeStageId] : null;
  const fogRevealStage = fogRevealStageId ? STAGES[fogRevealStageId] : null;
  const currentStage = activeStage ?? nextStageForArea ?? areaStages.find(stage => stage.nodeType === 'SAFE') ?? areaStages[0] ?? STAGES.area1_safe;

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!isMounted || !nextStage || clearedStages.length === 0 || typeof window === 'undefined') return;
    const key = `necro:fog-reveal:${clearedStages.length}:${nextStage.id}`;
    try {
      if (window.sessionStorage.getItem(key) === '1') return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage can be unavailable in private browsing.
    }
    setFogRevealStageId(nextStage.id);
  }, [clearedStages.length, isMounted, nextStage]);

  useEffect(() => {
    if (layer !== 'AREA' || !isMounted || !scrollRef.current || !currentStage) return;
    const el = scrollRef.current;
    const svgH = el.clientWidth * (VIEWBOX.height / VIEWBOX.width);
    const nodeY = (currentStage.position.y / VIEWBOX.height) * svgH;
    const targetScroll = nodeY - el.clientHeight * 0.42;
    el.scrollTop = Math.max(0, targetScroll);
  }, [currentStage, isMounted, layer]);

  if (!isMounted || !player) return null;

  const partyDisplay = [
    { icon: '☠', name: player.name, color: '#8A2BE2' },
    ...party.slice(0, 2).map((monster, i) => monster
      ? { icon: monster.tribe === 'DEMON' ? '◆' : '☾', name: monster.name, color: ['#22c55e', '#38bdf8'][i] }
      : { icon: '+', name: '未配置', color: '#4a3a5a' }
    ),
  ];

  if (layer === 'WORLD') {
    const currentArea = worldAreas.find(area => area.state === 'CURRENT') ?? worldAreas.find(area => area.state === 'AVAILABLE') ?? worldAreas[0] ?? null;

    return (
      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#05030f',
        fontFamily: "'Inter', sans-serif",
        overflow: 'hidden',
        color: '#f0ebff',
      }}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <svg
            viewBox={`0 0 ${WORLD_VIEWBOX.width} ${WORLD_VIEWBOX.height}`}
            preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <defs>
              <radialGradient id="worldGlow" cx="50%" cy="52%" r="64%">
                <stop offset="0%" stopColor="#1a0838" stopOpacity="0.74" />
                <stop offset="100%" stopColor="#03020a" stopOpacity="1" />
              </radialGradient>
              <radialGradient id="worldVignette" cx="50%" cy="50%" r="72%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="100%" stopColor="#03020a" stopOpacity="0.84" />
              </radialGradient>
              <filter id="worldNodeGlow">
                <feGaussianBlur stdDeviation="3.4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <rect width={WORLD_VIEWBOX.width} height={WORLD_VIEWBOX.height} fill="url(#worldGlow)" />
            <WorldTerrainLayer />
            <g filter="url(#worldNodeGlow)">
              {worldAreas.map(area => (
                <WorldAreaNode
                  key={area.area}
                  area={area}
                  isActive={activeWorldAreaId === area.area}
                  onClick={(clickedArea) => setActiveWorldAreaId(prev => prev === clickedArea.area ? null : clickedArea.area)}
                />
              ))}
            </g>
          </svg>
          <ParticleLayer />
        </div>

        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: 'max(12px, env(safe-area-inset-top, 12px)) 14px 18px',
          background: 'linear-gradient(180deg, rgba(5,2,16,0.98), rgba(5,2,16,0.78) 68%, transparent)',
          display: 'grid',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <button
                type="button"
                onClick={() => setCurrentTab('HOME')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: '#8b7da8',
                  fontSize: 11,
                  marginBottom: 6,
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                }}
              >
                <ChevronLeft size={15} />
                ホーム
              </button>
              <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 8, color: '#8A2BE2', letterSpacing: '0.18em' }}>LAYER 1 / WORLD MAP</div>
              <div style={{
                fontFamily: "'Cinzel', serif",
                fontSize: 'clamp(19px, 5.5vw, 25px)',
                fontWeight: 900,
                letterSpacing: '0.04em',
                textShadow: '0 0 20px rgba(138,43,226,0.58)',
                lineHeight: 1.1,
              }}>ワールドマップ</div>
            </div>
            <div style={{ display: 'grid', gap: 7, justifyItems: 'end', flexShrink: 0 }}>
              <HeaderStat label="FLOW" value="WORLD → AREA" icon={<Globe2 size={14} />} />
              <HeaderStat label="BATTLE" value="NODE → 3 WAVE" icon={<Swords size={14} />} />
            </div>
          </div>
        </div>

        {!activeWorldArea && (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            padding: '24px 14px max(16px, env(safe-area-inset-bottom, 16px))',
            background: 'linear-gradient(0deg, rgba(5,2,16,0.98), rgba(5,2,16,0.78) 66%, transparent)',
            display: 'grid',
            gap: 10,
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 14,
              background: 'rgba(5,2,16,0.86)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(14px)',
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#8A2BE2', fontFamily: "'Cinzel', serif", fontSize: 8, fontWeight: 900, letterSpacing: '0.14em' }}>
                  <Castle size={14} />
                  CURRENT FRONT
                </div>
                <div style={{ marginTop: 3, color: '#f0ebff', fontFamily: "'Cinzel', serif", fontSize: 14, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentArea?.nameJa ?? '未選択'}
                </div>
                <div style={{ marginTop: 2, color: '#6b5f7a', fontSize: 9 }}>
                  Layer 1で領域を選び、Layer 2のエリアマップへ進む
                </div>
              </div>
              <button
                type="button"
                disabled={!currentArea || currentArea.state === 'LOCKED'}
                onClick={() => currentArea && setActiveWorldAreaId(currentArea.area)}
                style={{
                  minHeight: 44,
                  padding: '0 15px',
                  borderRadius: 12,
                  border: '1px solid rgba(138,43,226,0.68)',
                  background: 'linear-gradient(135deg, rgba(138,43,226,0.42), rgba(6,3,16,0.92))',
                  color: '#f0ebff',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  boxShadow: '0 0 18px rgba(138,43,226,0.32)',
                }}
              >
                <MapPin size={15} />
                領域選択
              </button>
            </div>
          </div>
        )}

        {activeWorldArea && (
          <>
            <div
              onClick={() => setActiveWorldAreaId(null)}
              style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(0,0,0,0.38)', animation: 'fadeIn 0.2s ease-out' }}
            />
            <div style={{ position: 'absolute', inset: 0, zIndex: 16, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
                <WorldAreaSheet
                  area={activeWorldArea}
                  onClose={() => setActiveWorldAreaId(null)}
                  onEnter={() => {
                    if (activeWorldArea.state === 'LOCKED') return;
                    setSelectedArea(activeWorldArea.area);
                    setActiveWorldAreaId(null);
                    setActiveStageId(null);
                    setLayer('AREA');
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  const topSpacer = 74;
  const bottomSpacer = activeStage ? 420 : 170;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: '#05030f',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
      color: '#f0ebff',
    }}>
      <div
        ref={scrollRef}
        className="safe-scroll"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ height: topSpacer }} />
        <div style={{ position: 'relative', width: '100%', aspectRatio: `${VIEWBOX.width} / ${VIEWBOX.height}` }}>
          <svg
            viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <defs>
              <radialGradient id="mapGlow" cx="52%" cy="54%" r="62%">
                <stop offset="0%" stopColor="#1a0838" stopOpacity="0.72" />
                <stop offset="100%" stopColor="#03020a" stopOpacity="1" />
              </radialGradient>
              <radialGradient id="mapVignette" cx="50%" cy="50%" r="72%">
                <stop offset="0%" stopColor="transparent" />
                <stop offset="100%" stopColor="#03020a" stopOpacity="0.82" />
              </radialGradient>
              <filter id="nodeGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="url(#mapGlow)" />
            <TerrainLayer />
            <PathLines stages={areaStages} activeStageId={activeStageId} states={states} />
            <g filter="url(#nodeGlow)">
              {areaStages.map(stage => (
                <MapNode
                  key={stage.id}
                  stage={stage}
                  state={states[stage.id]}
                  isActive={activeStageId === stage.id}
                  isRevealing={fogRevealStageId === stage.id}
                  onClick={(clickedStage) => setActiveStageId(prev => prev === clickedStage.id ? null : clickedStage.id)}
                />
              ))}
            </g>
          </svg>
          <ParticleLayer />
        </div>
        <div style={{ height: bottomSpacer }} />
      </div>

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        padding: 'max(12px, env(safe-area-inset-top, 12px)) 14px 18px',
        background: 'linear-gradient(180deg, rgba(5,2,16,0.98), rgba(5,2,16,0.78) 68%, transparent)',
        display: 'grid',
        gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <button
              type="button"
              onClick={() => {
                setActiveStageId(null);
                setLayer('WORLD');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: '#8b7da8',
                fontSize: 11,
                marginBottom: 6,
                background: 'transparent',
                border: 0,
                padding: 0,
              }}
            >
              <ChevronLeft size={15} />
              ワールド
            </button>
            <div style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: 8, color: '#8A2BE2', letterSpacing: '0.18em' }}>LAYER 2 / AREA MAP</div>
            <div style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 'clamp(18px, 5vw, 23px)',
              fontWeight: 900,
              letterSpacing: '0.04em',
              textShadow: '0 0 20px rgba(138,43,226,0.58)',
              lineHeight: 1.1,
            }}>{selectedWorldArea?.nameJa ?? 'エリアマップ'}</div>
          </div>
          <div style={{ display: 'grid', gap: 7, justifyItems: 'end', flexShrink: 0 }}>
            <HeaderStat label="LAYER 3" value="DUNGEON NODE" icon={<Swords size={14} />} />
            <HeaderStat label="RULE" value="STAMINA FREE" icon={<Sparkles size={14} />} />
          </div>
        </div>
      </div>

      {!activeStage && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          padding: '24px 14px max(16px, env(safe-area-inset-bottom, 16px))',
          background: 'linear-gradient(0deg, rgba(5,2,16,0.98), rgba(5,2,16,0.78) 66%, transparent)',
          display: 'grid',
          gap: 10,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 14,
            background: 'rgba(5,2,16,0.86)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(14px)',
          }}>
            <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
              {partyDisplay.map((member, i) => (
                <div key={`${member.name}-${i}`} title={member.name} style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${member.color}24, #0a0515)`,
                  border: `1.5px solid ${member.color}66`,
                  display: 'grid',
                  placeItems: 'center',
                  color: member.color,
                  fontWeight: 900,
                  flexShrink: 0,
                }}>{member.icon}</div>
              ))}
            </div>
            <button
              type="button"
              disabled={!nextStageForArea}
              onClick={() => nextStageForArea && setActiveStageId(nextStageForArea.id)}
              style={{
                minHeight: 44,
                padding: '0 15px',
                borderRadius: 12,
                border: '1px solid rgba(138,43,226,0.68)',
                background: 'linear-gradient(135deg, rgba(138,43,226,0.42), rgba(6,3,16,0.92))',
                color: '#f0ebff',
                fontFamily: "'Cinzel', serif",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: '0.08em',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 0 18px rgba(138,43,226,0.32)',
              }}
            >
              <MapPin size={15} />
              次の侵攻
            </button>
          </div>
        </div>
      )}

      {activeStage && (
        <>
          <div
            onClick={() => setActiveStageId(null)}
            style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'rgba(0,0,0,0.38)', animation: 'fadeIn 0.2s ease-out' }}
          />
          <div style={{ position: 'absolute', inset: 0, zIndex: 16, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
              <DetailSheet
                stage={activeStage}
                state={states[activeStage.id]}
                onClose={() => setActiveStageId(null)}
                onEnter={() => {
                  if (states[activeStage.id] === 'LOCKED') return;
                  setActiveStageId(null);
                  onStartStage(activeStage.id);
                }}
                onGoHome={() => {
                  setActiveStageId(null);
                  setCurrentTab('HOME');
                }}
              />
            </div>
          </div>
        </>
      )}
      {fogRevealStage && fogRevealStage.area === selectedAreaId && (
        <FogRevealOverlay
          stage={fogRevealStage}
          onDone={() => setFogRevealStageId(null)}
        />
      )}
    </div>
  );
}
