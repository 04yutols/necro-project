'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MonsterData } from '../../types/game';
import { soulStoneAction } from '../../app/actions';
import { Ghost, Skull, Sparkles, AlertTriangle, Shield } from 'lucide-react';
import { GameFrame } from '../ui/GameFrame';
import { BloodButton } from '../ui/BloodButton';

export default function NecroLab() {
  const { 
    player, 
    necroStatus, 
    party, 
    inventoryMonsters, 
    soulShards,
    updatePartySlot, 
    removeMonster, 
    addSoulShard,
    setEquippingMonsterId
  } = useGameStore();

  const [isProcessing, setIsInProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  // 合計コストの計算
  const totalCost = useMemo(() => {
    return party.reduce((acc, m) => acc + (m?.cost || 0), 0);
  }, [party]);

  const isOverCost = necroStatus ? totalCost > necroStatus.maxCost : false;

  const handleSoulStone = async (monsterId: string) => {
    if (!confirm('このモンスターを魂の欠片に変換しますか？（モンスターは消滅します）')) return;
    
    setIsInProcessing(true);
    try {
      const result = await soulStoneAction(monsterId);
      if (result.success && result.data) {
        removeMonster(monsterId);
        addSoulShard(result.data as any);
        showNotification(`${result.data.originMonsterName}は魂の欠片になりました。`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsInProcessing(false);
    }
  };

  const handleSlotClick = async (slotIndex: number, monster: MonsterData | null) => {
    updatePartySlot(slotIndex, monster);
  };

  const getEffectiveStats = (monster: MonsterData) => {
    const shard = soulShards.find(s => s.id === monster.equippedShardId);
    return {
      atk: monster.stats.atk + (shard?.effect.atkBonus || 0),
      matk: monster.stats.matk + (shard?.effect.matkBonus || 0),
    };
  };

  if (!necroStatus) return <div className="text-blood text-center p-8 border-2 border-blood/20 rounded-xl bg-blood/5 font-bold uppercase tracking-widest animate-pulse font-cinzel">NOT QUALIFIED AS A NECROMANCER.</div>;

  return (
    <GameFrame title={<span className="flex items-center gap-2"><Skull size={18} /> NECRO-LAB</span>} borderColor="necro" className="w-full">
      {/* 通知ポップアップ */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-blood border-2 border-red-500 text-white px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(136,8,8,0.5)] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold font-noto">{notification}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* パーティ編成セクション */}
        <section className="space-y-4">
          <div className="flex justify-between items-end mb-4 border-b border-white/10 pb-2">
            <h2 className="text-sm font-bold font-cinzel text-gray-400 tracking-widest flex items-center gap-2">
              <Ghost className="w-4 h-4" /> CURRENT PARTY
            </h2>
            <div className={`text-sm font-bold px-3 py-1 rounded transition-colors border ${isOverCost ? 'bg-blood/20 border-blood text-red-500 animate-pulse' : 'bg-necro/20 border-necro text-necro'}`}>
              COST: {totalCost} / {necroStatus.maxCost}
              {isOverCost && <AlertTriangle className="inline ml-2 w-4 h-4" />}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {party.map((m, i) => (
              <button 
                key={i} 
                className={`aspect-[3/4] min-h-[160px] border-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden relative group
                  ${m ? 'border-necro bg-necro/10 hover:bg-necro/20 shadow-[inset_0_0_20px_rgba(168,85,247,0.1)]' : 'border-gray-700 border-dashed hover:border-necro/50 bg-black/40'}
                `}
                onClick={() => handleSlotClick(i, null)}
              >
                {m ? (
                  <>
                    <span className="absolute top-2 left-2 text-[10px] text-necro font-bold font-cinzel uppercase">SLOT {i + 1}</span>
                    <div className="text-md font-bold text-white text-center px-2 mt-4 font-noto">{m.name}</div>
                    <div className="text-xs mt-2 text-gray-400 font-mono">COST {m.cost}</div>
                    <div className="text-[10px] mt-1 text-green-400 font-bold font-mono">ATK {getEffectiveStats(m).atk}</div>
                    {m.equippedShardId && <Sparkles size={12} className="text-necro mt-2 animate-pulse" />}
                    
                    {/* Hover to unequip layer */}
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-white font-cinzel">REMOVE</span>
                    </div>
                  </>
                ) : (
                  <span className="text-gray-600 font-bold uppercase tracking-widest text-[10px] font-cinzel">EMPTY</span>
                )}
              </button>
            ))}
          </div>

          {isOverCost && (
            <div className="mt-6 p-3 bg-blood/10 border border-blood text-red-400 text-xs flex items-center gap-3 rounded animate-bounce font-noto">
              <AlertTriangle className="shrink-0 w-4 h-4" />
              <span>軍団の合計コストが最大値を超えています。このままでは出撃できません。</span>
            </div>
          )}
        </section>

        {/* モンスターリスト */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold font-cinzel text-gray-400 tracking-widest border-b border-white/10 pb-2 mb-4">INVENTORY MONSTERS</h2>
          <div className="grid grid-cols-1 gap-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            {inventoryMonsters.length === 0 && (
              <div className="text-center py-8 text-gray-600 italic border border-dashed border-gray-800 rounded bg-black/30 font-noto text-sm">
                ストックモンスターがいません。
              </div>
            )}
            {inventoryMonsters.map((m) => {
              const stats = getEffectiveStats(m);
              return (
                <div key={m.id} className="bg-black/60 border border-gray-800 p-3 rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-3 group hover:border-necro/50 transition-colors">
                  <div>
                    <div className="font-bold text-white flex items-center gap-2 font-noto text-sm">
                      {m.name} 
                      <span className="text-[9px] text-necro px-1 border border-necro/30 uppercase font-cinzel tracking-wider">{m.tribe}</span>
                      {m.equippedShardId && <Sparkles size={12} className="text-necro animate-pulse" />}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase mt-1 font-mono">
                      COST: {m.cost} | ATK: <span className={m.equippedShardId ? "text-green-400 font-bold" : ""}>{stats.atk}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setEquippingMonsterId(m.id);
                      }}
                      className="p-2 bg-gray-900 hover:bg-necro/20 border border-gray-700 hover:border-necro text-gray-500 hover:text-necro rounded transition-all cursor-pointer z-10 relative"
                      title="欠片を装備"
                    >
                      <Shield size={14} />
                    </button>
                    <button 
                      disabled={isProcessing}
                      onClick={() => handleSoulStone(m.id)}
                      className="p-2 bg-gray-900 hover:bg-blood/20 border border-gray-700 hover:border-blood text-gray-500 hover:text-blood rounded transition-all tooltip relative z-10 disabled:opacity-50"
                      title="魂石化"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    <BloodButton 
                      variant="ghost"
                      onClick={() => {
                        const emptyIndex = party.findIndex(p => p === null);
                        if (emptyIndex !== -1) {
                          handleSlotClick(emptyIndex, m);
                        } else {
                          showNotification('軍団の枠がいっぱいです。配置を解除してから再度試してください');
                        }
                      }}
                      className="px-3 py-1 text-[10px] border border-gray-700 h-auto"
                    >
                      DEPLOY
                    </BloodButton>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </GameFrame>
  );
}
