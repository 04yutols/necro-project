'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { MonsterData, SoulShardData } from '../../types/game';

interface ShardEquipModalProps {
  monster: MonsterData;
  onClose: () => void;
}

type Feedback = { kind: 'success' | 'error'; text: string } | null;

export default function ShardEquipModal({ monster, onClose }: ShardEquipModalProps) {
  const { soulShards, equipShard } = useGameStore();
  const [selectedShard, setSelectedShard] = useState<SoulShardData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(true, onClose);

  const currentShard = soulShards.find((s) => s.id === monster.equippedShardId);
  const currentAtk = monster.stats.atk + (currentShard?.effect.atkBonus ?? 0);
  const previewAtk = selectedShard ? monster.stats.atk + selectedShard.effect.atkBonus : currentAtk;
  const delta = selectedShard ? selectedShard.effect.atkBonus - (currentShard?.effect.atkBonus ?? 0) : 0;
  const selectedIsCurrent = Boolean(selectedShard && currentShard?.id === selectedShard.id);

  const shardRows = useMemo(
    () => [...soulShards].sort((a, b) => b.effect.atkBonus - a.effect.atkBonus),
    [soulShards],
  );

  const handleEquip = async () => {
    if (!selectedShard || selectedIsCurrent) return;
    setIsProcessing(true);
    setFeedback(null);
    try {
      equipShard(monster.id, selectedShard.id);
      setFeedback({ kind: 'success', text: '魂の欠片を装備しました' });
      window.setTimeout(onClose, 180);
    } catch (e) {
      setFeedback({
        kind: 'error',
        text: e instanceof Error ? e.message : '装備に失敗しました',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shard-equip-title"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="gothic-panel relative z-[101] w-full max-w-lg overflow-hidden rounded-lg text-[#F0EAFF] shadow-[0_24px_70px_rgba(0,0,0,0.72)]">
        <header className="relative flex items-center justify-between border-b border-white/10 bg-black/20 px-4 py-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-black tracking-[0.18em] text-[#D4AF37]">
              <Sparkles size={14} />
              SOUL SHARD
            </div>
            <h2 id="shard-equip-title" className="m-0 font-cinzel text-lg font-black tracking-[0.08em]">
              魂の欠片 装備
            </h2>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-[#A5A9B4] transition-colors hover:text-[#F0EAFF]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="relative space-y-5 p-4">
          <section className="rounded-lg border border-[#8B00FF33] bg-[#0A0612]/85 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 text-[10px] font-black tracking-[0.16em] text-[#A5A9B4]">対象</div>
                <div className="truncate font-cinzel text-lg font-black">{monster.name}</div>
                <div className="mt-1 text-[11px] text-[#8b7da8]">
                  {currentShard ? `${currentShard.originMonsterName}の欠片を装備中` : '未装備'}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-black tracking-[0.16em] text-[#A5A9B4]">ATK</div>
                <div className="font-cinzel text-2xl font-black text-[#D4AF37]">{currentAtk}</div>
              </div>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="m-0 text-[11px] font-black tracking-[0.18em] text-[#A5A9B4]">装備候補</h3>
              <span className="text-[10px] font-bold text-[#8b7da8]">{shardRows.length} 個</span>
            </div>

            <div className="custom-scrollbar grid max-h-52 grid-cols-1 gap-2 overflow-y-auto pr-1">
              {shardRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.025] px-4 py-8 text-center">
                  <p className="m-0 text-sm font-bold text-[#A5A9B4]">魂の欠片がありません</p>
                  <p className="m-0 mt-2 text-[11px] leading-5 text-[#8b7da8]">
                    モンスターを魂石化すると、ここに装備候補が並びます。
                  </p>
                </div>
              ) : (
                shardRows.map((shard) => {
                  const selected = selectedShard?.id === shard.id;
                  const equipped = currentShard?.id === shard.id;
                  return (
                    <button
                      key={shard.id}
                      type="button"
                      onClick={() => {
                        setSelectedShard(shard);
                        setFeedback(null);
                      }}
                      className="w-full rounded-lg border p-3 text-left transition-all"
                      style={{
                        background: selected ? 'rgba(139,0,255,0.16)' : 'rgba(0,0,0,0.32)',
                        borderColor: selected ? 'rgba(212,175,55,0.55)' : 'rgba(255,255,255,0.09)',
                        boxShadow: selected ? '0 0 18px rgba(139,0,255,0.22)' : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-[#F0EAFF]">
                            {shard.originMonsterName}の欠片
                          </div>
                          {equipped && <div className="mt-1 text-[10px] font-bold text-[#D4AF37]">装備中</div>}
                        </div>
                        <div className="shrink-0 font-cinzel text-sm font-black text-[#D4AF37]">
                          ATK +{shard.effect.atkBonus}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {selectedShard && (
            <section className="rounded-lg border border-[#D4AF3744] bg-[#D4AF37]/[0.06] p-4">
              <div className="mb-3 text-center text-[10px] font-black tracking-[0.18em] text-[#D4AF37]">
                装備プレビュー
              </div>
              <div className="flex items-center justify-center gap-5">
                <div className="text-center">
                  <div className="font-cinzel text-2xl font-black">{currentAtk}</div>
                  <div className="mt-1 text-[10px] text-[#8b7da8]">現在</div>
                </div>
                <ArrowRight className="text-[#D4AF37]" size={20} />
                <div className="text-center">
                  <div className="font-cinzel text-3xl font-black text-[#86efac] drop-shadow-[0_0_8px_rgba(74,222,128,0.45)]">
                    {previewAtk}
                  </div>
                  <div className="mt-1 text-[10px] font-black text-[#86efac]">
                    {delta >= 0 ? '+' : ''}{delta}
                  </div>
                </div>
              </div>
            </section>
          )}

          {feedback && (
            <div
              className="rounded-lg border px-3 py-2 text-sm"
              style={{
                background: feedback.kind === 'success' ? 'rgba(34,197,94,0.10)' : 'rgba(139,0,0,0.18)',
                borderColor: feedback.kind === 'success' ? 'rgba(34,197,94,0.28)' : 'rgba(220,38,38,0.34)',
                color: feedback.kind === 'success' ? '#86efac' : '#FFB4B4',
              }}
            >
              {feedback.text}
            </div>
          )}
        </div>

        <footer className="relative flex gap-3 border-t border-white/10 bg-black/30 p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-lg border border-white/12 bg-white/[0.035] text-sm font-black tracking-[0.12em] text-[#A5A9B4]"
          >
            閉じる
          </button>
          <button
            type="button"
            disabled={!selectedShard || selectedIsCurrent || isProcessing}
            onClick={handleEquip}
            className="min-h-12 flex-[2] rounded-lg border text-sm font-black tracking-[0.12em] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              background: 'linear-gradient(135deg, rgba(139,0,255,0.42), rgba(212,175,55,0.14))',
              borderColor: 'rgba(139,0,255,0.58)',
              color: '#F0EAFF',
              boxShadow: '0 0 20px rgba(139,0,255,0.25)',
            }}
          >
            {isProcessing ? '装備中' : selectedIsCurrent ? '装備中' : '装備'}
          </button>
        </footer>
      </div>
    </div>
  );
}
