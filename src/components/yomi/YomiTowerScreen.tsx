'use client';

import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Gift, Lock, Shield, Skull, Swords } from 'lucide-react';
import stagesData from '../../data/master/stages.json';
import type { StageData } from '../../types/game';
import { getYomiFloorNumber, isYomiStage } from '../../logic/YomiFloors';
import { useGameStore } from '../../store/useGameStore';
import { useRanking } from '../../hooks/useRanking';
import { MOTION } from '../../lib/motion';

type FloorState = 'CLEARED' | 'AVAILABLE' | 'LOCKED';

interface YomiFloorEntry {
  stage: StageData;
  floor: number;
  state: FloorState;
  isElite: boolean;
  isBoss: boolean;
  isMilestone: boolean;
}

interface YomiTowerScreenProps {
  onChallenge: (stageId: string) => void;
}

const STAGES = stagesData as Record<string, StageData>;

function bestClearedFloor(clearedStages: readonly string[]): number {
  return clearedStages.reduce((best, stageId) => {
    const floor = getYomiFloorNumber(stageId);
    return floor === null ? best : Math.max(best, floor);
  }, 0);
}

function buildFloorEntries(clearedStages: readonly string[]): YomiFloorEntry[] {
  const cleared = new Set(clearedStages);
  return Object.values(STAGES)
    .map(stage => ({ stage, floor: getYomiFloorNumber(stage.id) }))
    .filter((entry): entry is { stage: StageData; floor: number } => isYomiStage(entry.stage.id) && entry.floor !== null)
    .sort((a, b) => a.floor - b.floor)
    .map(({ stage, floor }) => {
      const isCleared = cleared.has(stage.id);
      const isAvailable = !isCleared && stage.unlockRequires.every(requiredId => cleared.has(requiredId));
      return {
        stage,
        floor,
        state: isCleared ? 'CLEARED' : isAvailable ? 'AVAILABLE' : 'LOCKED',
        isElite: floor % 5 === 0 && floor % 10 !== 0,
        isBoss: floor % 10 === 0,
        isMilestone: floor % 5 === 0,
      };
    });
}

function YomiRankingStrip({ localBestFloor }: { localBestFloor: number }) {
  const { entries, loading } = useRanking('DUNGEON_FLOOR', { limit: 3 });

  return (
    <div
      className="shrink-0"
      style={{
        borderTop: '1px solid rgba(139,0,255,0.18)',
        borderBottom: '1px solid rgba(139,0,255,0.18)',
        background: 'rgba(255,255,255,0.025)',
        padding: '8px 10px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <div className="min-w-0 flex items-center gap-2 overflow-hidden">
        <Shield size={14} style={{ color: '#D4AF37' }} />
        {loading ? (
          <span className="text-[9px] font-black tracking-[0.14em] animate-pulse" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>SYNCING...</span>
        ) : entries.length === 0 ? (
          <span className="truncate text-[10px] font-bold" style={{ color: '#8b7da8' }}>記録なし</span>
        ) : entries.map(entry => (
          <span
            key={`${entry.userId}-${entry.rank}`}
            className="truncate text-[9px] font-black"
            style={{ color: entry.rank === 1 ? '#D4AF37' : '#c9b6ff', fontFamily: 'monospace' }}
          >
            #{entry.rank} B{entry.value}
          </span>
        ))}
      </div>
      <div className="text-right">
        <div className="text-[8px] font-black tracking-[0.14em]" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>SELF</div>
        <div className="text-[12px] font-black" style={{ color: '#F0EAFF', fontFamily: 'monospace' }}>B{localBestFloor}</div>
      </div>
    </div>
  );
}

function statusText(entry: YomiFloorEntry): string {
  if (entry.state === 'CLEARED') return '踏破済';
  if (entry.state === 'AVAILABLE') return '現在地';
  return '封鎖';
}

function YomiFloorCard({
  entry,
  onChallenge,
}: {
  entry: YomiFloorEntry;
  onChallenge: (stageId: string) => void;
}) {
  const actionable = entry.state !== 'LOCKED';
  const borderColor = entry.isBoss
    ? 'rgba(220,38,38,0.58)'
    : entry.isElite
      ? 'rgba(212,175,55,0.46)'
      : entry.state === 'AVAILABLE'
        ? 'rgba(139,0,255,0.62)'
        : 'rgba(139,0,255,0.18)';
  const Icon = entry.isBoss ? Skull : entry.isElite ? Shield : entry.state === 'LOCKED' ? Lock : Check;

  return (
    <motion.div
      layout={false}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION.spring.soft, delay: Math.min(entry.floor * 0.018, 0.3) }}
      style={{
        position: 'relative',
        minHeight: entry.isBoss || entry.isElite ? 82 : 66,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        background: entry.state === 'AVAILABLE'
          ? 'linear-gradient(135deg, rgba(139,0,255,0.22), rgba(18,8,34,0.72))'
          : entry.state === 'CLEARED'
            ? 'rgba(255,255,255,0.035)'
            : 'rgba(18,18,18,0.72)',
        boxShadow: entry.state === 'AVAILABLE' ? '0 0 22px rgba(139,0,255,0.30)' : 'none',
        opacity: entry.state === 'LOCKED' ? 0.62 : 1,
        padding: '10px 10px 10px 12px',
        display: 'grid',
        gridTemplateColumns: '44px minmax(0, 1fr) auto',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {entry.isElite || entry.isBoss ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            borderRadius: 3,
            background: entry.isBoss ? 'linear-gradient(#8B00FF, #8B0000)' : '#D4AF37',
          }}
        />
      ) : null}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          display: 'grid',
          placeItems: 'center',
          color: entry.isBoss ? '#fb7185' : entry.isElite ? '#D4AF37' : entry.state === 'LOCKED' ? '#4a3a5a' : '#BC00FB',
          background: 'rgba(0,0,0,0.22)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 text-[15px] font-black" style={{ color: '#F0EAFF', fontFamily: 'monospace' }}>B{entry.floor}</span>
          <span className="truncate text-[12px] font-black" style={{ color: entry.state === 'LOCKED' ? '#8b7da8' : '#F0EAFF' }}>
            {entry.stage.nameJa}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[9px] font-black tracking-[0.12em]" style={{ fontFamily: 'monospace' }}>
          <span style={{ color: entry.state === 'AVAILABLE' ? '#D4AF37' : '#8b7da8' }}>{statusText(entry)}</span>
          {entry.isBoss ? <span style={{ color: '#fb7185' }}>深淵の主</span> : null}
          {entry.isElite ? <span style={{ color: '#D4AF37' }}>精鋭階</span> : null}
          {entry.isMilestone ? (
            <span className="inline-flex items-center gap-1" style={{ color: entry.state === 'CLEARED' ? '#8DFFBF' : '#D4AF37' }}>
              <Gift size={10} />
              {entry.state === 'CLEARED' ? '受取済' : '宝箱'}
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        disabled={!actionable}
        onClick={() => onChallenge(entry.stage.id)}
        className="min-h-11 px-3 text-[10px] font-black tracking-[0.12em] transition-colors"
        style={{
          minHeight: 44,
          borderRadius: 8,
          border: actionable ? '1px solid rgba(139,0,255,0.55)' : '1px solid rgba(255,255,255,0.06)',
          background: actionable ? 'rgba(139,0,255,0.18)' : 'rgba(255,255,255,0.03)',
          color: actionable ? '#F0EAFF' : '#4a3a5a',
        }}
      >
        {entry.state === 'CLEARED' ? '再挑戦' : '挑戦'}
      </button>
    </motion.div>
  );
}

export function YomiTowerScreen({ onChallenge }: YomiTowerScreenProps) {
  const player = useGameStore(state => state.player);
  const clearedStages = player?.clearedStages ?? [];
  const entries = useMemo(() => buildFloorEntries(clearedStages), [clearedStages]);
  const localBestFloor = useMemo(() => bestClearedFloor(clearedStages), [clearedStages]);
  const currentEntry = entries.find(entry => entry.state === 'AVAILABLE')
    ?? [...entries].reverse().find(entry => entry.state === 'CLEARED')
    ?? entries[0]
    ?? null;
  const currentRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, [currentEntry?.stage.id]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: '#050505', color: '#F0EAFF' }}>
      <div className="shrink-0 px-3 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(139,0,255,0.18)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[18px] font-black truncate" style={{ fontFamily: "var(--font-cinzel-decorative), 'Cinzel Decorative', serif", color: '#F0EAFF', textShadow: '0 0 18px rgba(139,0,255,0.42)' }}>
              黄泉の階層
            </div>
            <div className="mt-1 text-[11px] leading-relaxed" style={{ color: '#A5A9B4' }}>
              亡国の敵影が沈殿する地下階層
            </div>
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-2 text-center">
            <div style={{ minWidth: 54, border: '1px solid rgba(139,0,255,0.22)', borderRadius: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[8px] font-black tracking-[0.12em]" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>現在地</div>
              <div className="text-[13px] font-black" style={{ color: '#D4AF37', fontFamily: 'monospace' }}>B{currentEntry?.floor ?? 0}</div>
            </div>
            <div style={{ minWidth: 54, border: '1px solid rgba(139,0,255,0.22)', borderRadius: 8, padding: '6px 8px', background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-[8px] font-black tracking-[0.12em]" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>最深</div>
              <div className="text-[13px] font-black" style={{ color: '#BC00FB', fontFamily: 'monospace' }}>B{localBestFloor}</div>
            </div>
          </div>
        </div>
      </div>

      <YomiRankingStrip localBestFloor={localBestFloor} />

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-3">
        <div className="grid gap-2 content-start">
          {entries.map(entry => (
            <div key={entry.stage.id} ref={entry.stage.id === currentEntry?.stage.id ? currentRef : undefined}>
              <YomiFloorCard entry={entry} onChallenge={onChallenge} />
            </div>
          ))}
          {entries.length === 0 ? (
            <div className="py-10 text-center text-[11px]" style={{ color: '#8b7da8' }}>階層データがありません</div>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-3 py-2" style={{ borderTop: '1px solid rgba(139,0,255,0.14)', background: 'rgba(5,5,5,0.92)' }}>
        <button
          type="button"
          onClick={() => currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
          className="w-full min-h-11 flex items-center justify-center gap-2 text-[10px] font-black tracking-[0.14em]"
          style={{
            minHeight: 44,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: '#A5A9B4',
          }}
        >
          <ChevronDown size={14} />
          現在地へ
          <Swords size={14} />
        </button>
      </div>
    </div>
  );
}
