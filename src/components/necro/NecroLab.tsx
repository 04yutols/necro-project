'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MonsterData } from '../../types/game';
import { soulStoneAction } from '../../app/actions';
import { Ghost, Skull, Sparkles, AlertTriangle, Shield } from 'lucide-react';
import { GameFrame } from '../ui/GameFrame';
import { FuchsiaButton } from '../ui/FuchsiaButton';

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

  if (!necroStatus) return <div className="text-fuchsia text-center p-8 border-2 border-fuchsia/20 rounded-xl bg-fuchsia/5 font-bold uppercase tracking-widest animate-pulse font-cinzel">NOT QUALIFIED AS A NECROMANCER.</div>;

  return (
    <GameFrame title={<span className="flex items-center gap-2"><Skull size={18} /> NECRO-LAB</span>} borderColor="necro" className="w-full">
      {/* 通知ポップアップ */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-fuchsia border-2 border-fuchsia text-white px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(255,0,255,0.5)] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold font-noto">{notification}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
        {/* パーティ編成セクション */}
        <section className="space-y-4">
          <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
            <h2 className="text-[10px] lg:text-sm font-black font-headline text-gray-400 tracking-widest flex items-center gap-2">
              <Ghost size={14} /> ACTIVE LEGION
            </h2>
            <div className={`text-[10px] lg:text-xs font-black px-3 py-1 rounded-full border transition-all ${isOverCost ? 'bg-error/20 border-error text-error animate-pulse' : 'bg-secondary/10 border-secondary/30 text-secondary'}`}>
              COST: {totalCost} / {necroStatus.maxCost}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            {party.map((m, i) => (
              <button 
                key={i} 
                className={`aspect-[3/4] border-2 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden relative group
                  ${m ? 'border-primary/50 bg-primary/5 hover:bg-primary/10 shadow-[inset_0_0_20px_rgba(188,0,251,0.05)]' : 'border-white/5 border-dashed hover:border-primary/30 bg-black/20'}
                `}
                onClick={() => handleSlotClick(i, null)}
              >
                {m ? (
                  <>
                    <div className="text-[8px] lg:text-[10px] font-black text-white text-center px-1 mb-1 truncate w-full uppercase">{m.name}</div>
                    <div className="text-[7px] lg:text-[8px] text-gray-500 font-mono">C{m.cost} | A{getEffectiveStats(m).atk}</div>
                    {m.equippedShardId && <Sparkles size={10} className="text-primary mt-1 animate-pulse" />}
                    
                    <div className="absolute inset-0 bg-error/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] font-black text-white tracking-tighter">DISMISS</span>
                    </div>
                  </>
                ) : (
                  <span className="text-white/20 font-black tracking-widest text-[8px] uppercase">Slot {i+1}</span>
                )}
              </button>
            ))}
          </div>

          {isOverCost && (
            <div className="mt-6 p-3 bg-fuchsia/10 border border-fuchsia text-fuchsia text-xs flex items-center gap-3 rounded animate-bounce font-noto">
              <AlertTriangle className="shrink-0 w-4 h-4" />
              <span>軍団の合計コストが最大値を超えています。このままでは出撃できません。</span>
            </div>
          )}
        </section>

        {/* モンスターリスト */}
        <section className="space-y-4">
          <h2 className="text-[10px] lg:text-sm font-black font-headline text-gray-400 tracking-widest border-b border-white/5 pb-2 mb-4 uppercase">
            Captured Spirits
          </h2>
          <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[400px] lg:max-h-[600px] pr-2 custom-scrollbar">
            {inventoryMonsters.length === 0 && (
              <div className="text-center py-12 text-white/20 italic border border-dashed border-white/5 rounded-xl bg-black/20 font-headline text-[10px] tracking-widest uppercase">
                Void is Empty
              </div>
            )}
            {inventoryMonsters.map((m) => {
              const stats = getEffectiveStats(m);
              return (
                <div key={m.id} className="bg-surface/40 border border-white/5 p-3 lg:p-4 rounded-xl flex justify-between items-center gap-4 hover:border-primary/30 transition-all group">
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white flex items-center gap-2 text-[10px] lg:text-xs uppercase truncate">
                      {m.name} 
                      <span className="text-[7px] text-primary/60 border border-primary/20 px-1 rounded tracking-tighter">{m.tribe}</span>
                    </div>
                    <div className="text-[8px] text-gray-500 uppercase mt-1 font-mono">
                      C: {m.cost} | ATK: <span className={m.equippedShardId ? "text-secondary font-black" : ""}>{stats.atk}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setEquippingMonsterId(m.id); }}
                      className="p-2 bg-black/40 hover:bg-primary/20 border border-white/5 hover:border-primary/50 text-gray-500 hover:text-primary rounded-lg transition-all"
                    >
                      <Shield size={14} />
                    </button>
                    <FuchsiaButton 
                      variant="ghost"
                      onClick={() => {
                        const emptyIndex = party.findIndex(p => p === null);
                        if (emptyIndex !== -1) handleSlotClick(emptyIndex, m);
                      }}
                      className="px-4 py-1 text-[8px] h-auto border-white/10"
                    >
                      DEPLOY
                    </FuchsiaButton>
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
