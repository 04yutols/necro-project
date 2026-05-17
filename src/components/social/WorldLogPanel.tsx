'use client';

import { Crown, Radio, ShieldCheck, Skull, Sparkles, Trophy } from 'lucide-react';
import { useRanking } from '../../hooks/useRanking';
import { useWorldLog } from '../../hooks/useWorldLog';
import type { RankingType, WorldEventType, WorldLogEntry } from '../../types/online';

const EVENT_META: Record<WorldEventType, { label: string; color: string; icon: typeof Sparkles }> = {
  UR_DISCOVERED: { label: 'UNIQUE RARE', color: '#BC00FB', icon: Skull },
  SSR_DISCOVERED: { label: 'SSR DISCOVERY', color: '#D4AF37', icon: Sparkles },
  BOSS_CLEARED: { label: 'BOSS FIRST CLEAR', color: '#f97316', icon: Trophy },
  RANKING_UPDATED: { label: 'RANKING', color: '#8DFFBF', icon: Crown },
};

const RANKING_LABEL: Record<RankingType, string> = {
  RESIDUE_SCORE: '残滓スコア',
  STAGE_TIME: '竜骨祭壇最速',
  TOTAL_DAMAGE: '累計ダメージ',
  BOSS_KILLS: '魔王討伐数',
};

function formatEvent(event: WorldLogEntry) {
  const payload = event.payload;
  const player = String(payload.playerName ?? payload.displayName ?? '名もなき死霊術師');
  if (event.type === 'UR_DISCOVERED') {
    return `${player} が理外の呪装 [${String(payload.itemName ?? '???')}] No.${String(payload.serialNo ?? '?')} を発見`;
  }
  if (event.type === 'SSR_DISCOVERED') {
    return `${player} が [${String(payload.itemName ?? '???')}] を世界で初めて発見`;
  }
  if (event.type === 'BOSS_CLEARED') {
    return `${player} が [${String(payload.stageName ?? '???')}] を初攻略`;
  }
  return `${player} が ${String(payload.rankingName ?? 'ランキング')} の頂点に到達`;
}

function timeAgo(dateText: string) {
  const diff = Date.now() - new Date(dateText).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function RankingMiniBoard({ type, stageId }: { type: RankingType; stageId?: string }) {
  const { entries, loading } = useRanking(type, { stageId, limit: 5 });

  return (
    <div className="gothic-panel rounded-2xl p-3 flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} style={{ color: '#D4AF37' }} />
          <span className="text-[10px] font-black tracking-[0.16em]" style={{ color: '#D4AF37', fontFamily: 'monospace' }}>{RANKING_LABEL[type]}</span>
        </div>
        <span className="text-[8px] font-black" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>TOP 5</span>
      </div>
      <div className="grid gap-1.5">
        {loading ? (
          <div className="text-[10px] py-4 text-center animate-pulse" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>SYNCING...</div>
        ) : entries.length === 0 ? (
          <div className="text-[10px] py-4 text-center" style={{ color: '#6b5f7a' }}>まだ記録がありません</div>
        ) : entries.map(entry => (
          <div key={`${type}-${entry.userId}-${entry.rank}`} className="flex items-center gap-2 rounded-xl px-2 py-2" style={{ background: entry.rank === 1 ? 'rgba(212,175,55,0.10)' : 'rgba(255,255,255,0.035)', border: `1px solid ${entry.rank === 1 ? 'rgba(212,175,55,0.30)' : 'rgba(255,255,255,0.06)'}` }}>
            <span style={{ width: 24, color: entry.rank === 1 ? '#D4AF37' : '#8b7da8', fontFamily: "'Cinzel', serif", fontWeight: 900, fontSize: 13 }}>#{entry.rank}</span>
            <span className="flex-1 truncate" style={{ color: '#F0EAFF', fontSize: 11, fontWeight: 800 }}>{entry.playerName}</span>
            <span style={{ color: entry.rank === 1 ? '#D4AF37' : '#c9b6ff', fontFamily: 'monospace', fontSize: 10, fontWeight: 900 }}>
              {type === 'STAGE_TIME' ? `${entry.value}T` : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function WorldLogPanel() {
  const { events, loading, error } = useWorldLog();

  return (
    <div className="w-full h-full flex flex-col gap-3 overflow-hidden">
      <div className="shrink-0 gothic-panel rounded-2xl p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2" style={{ color: '#BC00FB' }}>
              <Radio size={15} />
              <span className="text-[10px] font-black tracking-[0.18em]" style={{ fontFamily: 'monospace' }}>WORLD LINK</span>
            </div>
            <div className="text-[12px] mt-1 font-black" style={{ color: '#F0EAFF' }}>世界ログ / グローバル記録</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[8px] font-black" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>SYNC</div>
            <div className="text-[11px] font-black" style={{ color: error ? '#fb7185' : '#8DFFBF', fontFamily: 'monospace' }}>{error ? 'LOCAL' : 'ONLINE'}</div>
          </div>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-2 gap-2">
        <RankingMiniBoard type="RESIDUE_SCORE" />
        <RankingMiniBoard type="STAGE_TIME" stageId="area1_boss" />
      </div>

      <div className="gothic-panel rounded-2xl p-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 shrink-0">
          <span className="text-[10px] font-black tracking-[0.16em]" style={{ color: '#BC00FB', fontFamily: 'monospace' }}>LIVE WORLD LOG</span>
          <span className="text-[8px] font-black" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>{events.length} EVENTS</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar grid gap-2 content-start pr-1">
          {loading ? (
            <div className="text-[10px] py-8 text-center animate-pulse" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>CONNECTING WORLD CHANNEL...</div>
          ) : events.length === 0 ? (
            <div className="text-[11px] py-8 text-center" style={{ color: '#8b7da8' }}>まだ世界イベントはありません。第1章ボスやSSR/UR発見でここに刻まれます。</div>
          ) : events.map(event => {
            const meta = EVENT_META[event.type] ?? EVENT_META.RANKING_UPDATED;
            const Icon = meta.icon;
            return (
              <div key={event.id} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${meta.color}30` }}>
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-xl grid place-items-center" style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}44`, boxShadow: `0 0 14px ${meta.color}18` }}>
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[8px] font-black tracking-[0.14em]" style={{ color: meta.color, fontFamily: 'monospace' }}>{meta.label}</span>
                      <span className="text-[8px] font-black" style={{ color: '#6b5f7a', fontFamily: 'monospace' }}>{timeAgo(event.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed font-bold" style={{ color: '#F0EAFF' }}>{formatEvent(event)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
