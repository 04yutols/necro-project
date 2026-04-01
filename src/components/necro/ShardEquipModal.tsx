'use client';

import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MonsterData, SoulShardData } from '../../types/game';
import { equipShardAction } from '../../app/actions';
import { Sparkles, X, ArrowRight } from 'lucide-react';

interface ShardEquipModalProps {
  monster: MonsterData;
  onClose: () => void;
}

export default function ShardEquipModal({ monster, onClose }: ShardEquipModalProps) {
  const { soulShards, equipShard } = useGameStore();
  const [selectedShard, setSelectedShard] = useState<SoulShardData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEquip = async () => {
    if (!selectedShard) return;
    setIsProcessing(true);
    try {
      const result = await equipShardAction(monster.id, selectedShard.id);
      if (result.success) {
        equipShard(monster.id, selectedShard.id);
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-dark border-2 border-necro w-full max-w-lg rounded-xl shadow-2xl overflow-hidden font-mono text-gray-300">
        <header className="p-4 border-b border-necro/30 flex justify-between items-center">
          <h2 className="text-xl font-bold text-necro uppercase flex items-center gap-2">
            <Sparkles size={20} /> 魂の欠片 装備
          </h2>
          <button onClick={onClose} className="hover:text-white transition-colors">
            <X size={24} />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {/* 対象モンスター情報 */}
          <div className="bg-necro/10 p-4 rounded border border-necro/30 flex justify-between items-center">
            <div>
              <div className="text-xs text-necro mb-1 uppercase font-bold">Target Monster</div>
              <div className="text-lg font-bold text-white">{monster.name}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1 uppercase">Current ATK</div>
              <div className="text-xl font-bold">{monster.stats.atk}</div>
            </div>
          </div>

          {/* 欠片リスト */}
          <div>
            <h3 className="text-sm font-bold mb-3 text-gray-400 uppercase">Available Soul Shards</h3>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {soulShards.length === 0 ? (
                <div className="text-center py-8 text-gray-600 italic border border-dashed border-gray-800 rounded">
                  No shards available.
                </div>
              ) : (
                soulShards.map((shard) => (
                  <button
                    key={shard.id}
                    onClick={() => setSelectedShard(shard)}
                    className={`w-full p-3 rounded border text-left transition-all ${
                      selectedShard?.id === shard.id
                        ? 'border-necro bg-necro/20 ring-1 ring-necro'
                        : 'border-gray-800 bg-black/40 hover:border-necro/50'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-white text-sm">{shard.originMonsterName}の欠片</div>
                      <div className="text-necro text-xs font-bold">ATK +{shard.effect.atkBonus}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* プレビュー領域 */}
          {selectedShard && (
            <div className="bg-blood/10 p-4 rounded border border-blood/30 animate-in fade-in slide-in-from-top-2 duration-300">
              <h3 className="text-xs font-bold mb-3 text-blood uppercase tracking-widest text-center">Status Preview</h3>
              <div className="flex justify-around items-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{monster.stats.atk}</div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">Base</div>
                </div>
                <ArrowRight className="text-blood animate-pulse" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]">
                    {monster.stats.atk + selectedShard.effect.atkBonus}
                  </div>
                  <div className="text-[10px] text-green-500 uppercase font-bold mt-1">After (+{selectedShard.effect.atkBonus})</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="p-4 bg-black/40 border-t border-necro/30 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-700 hover:bg-gray-800 transition-colors font-bold rounded"
          >
            CANCEL
          </button>
          <button
            disabled={!selectedShard || isProcessing}
            onClick={handleEquip}
            className="flex-[2] py-3 bg-necro hover:bg-purple-700 disabled:opacity-50 disabled:grayscale transition-all font-bold rounded shadow-[0_0_15px_rgba(168,85,247,0.3)] text-white"
          >
            {isProcessing ? 'EQUIPPING...' : 'EQUIP SHARD'}
          </button>
        </footer>
      </div>
    </div>
  );
}
