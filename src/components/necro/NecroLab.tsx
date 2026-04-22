'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MonsterData } from '../../types/game';
import { soulStoneAction } from '../../app/actions';
import { Ghost, Skull, Sparkles, AlertTriangle, Shield, Home } from 'lucide-react';
import { GameFrame } from '../ui/GameFrame';

export default function NecroLab() {
  const { 
    player, necroStatus, party, inventoryMonsters, soulShards,
    updatePartySlot, removeMonster, addSoulShard, setEquippingMonsterId, setCurrentTab
  } = useGameStore();

  const [isProcessing, setIsInProcessing] = useState(false);

  const totalCost = useMemo(() => {
    return party.reduce((acc, m) => acc + (m?.cost || 0), 0);
  }, [party]);

  const isOverCost = necroStatus ? totalCost > necroStatus.maxCost : false;

  const handleSoulStone = async (monsterId: string) => {
    if (!confirm('EXTRACT SOUL? (Monster will be destroyed)')) return;
    setIsInProcessing(true);
    try {
      const result = await soulStoneAction(monsterId);
      if (result.success && result.data) {
        removeMonster(monsterId);
        addSoulShard(result.data as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsInProcessing(false);
    }
  };

  const getEffectiveStats = (monster: MonsterData) => {
    const shard = soulShards.find(s => s.id === monster.equippedShardId);
    return {
      atk: monster.stats.atk + (shard?.effect.atkBonus || 0),
      matk: monster.stats.matk + (shard?.effect.matkBonus || 0),
    };
  };

  if (!necroStatus) return <div className="text-red-900 text-center p-8 font-bold uppercase tracking-widest animate-pulse font-serif">Unauthorized Access.</div>;

  return (
    <div className="flex flex-col gap-2 h-full pt-2 px-2 pb-6">
      {/* Back to Home Button */}
      <div className="flex items-center">
        <button 
          onClick={() => setCurrentTab('HOME')}
          className="flex items-center gap-2 text-gray-400 hover:text-tertiary transition-colors text-[10px] font-black tracking-widest uppercase mb-1 bg-black/40 border border-[#1A1A1A] px-3 py-1.5 rounded-md backdrop-blur-sm shadow-md"
        >
          <Home size={14} />
          <span>RETURN TO HUB</span>
        </button>
      </div>

      {/* Current Party */}
      <GameFrame 
        title={
          <div className="flex justify-between items-center w-full">
            <span className="flex items-center gap-2 tracking-widest"><Ghost size={12} /> ACTIVE LEGION</span>
            <span className={`text-[9px] ${isOverCost ? 'text-red-500 animate-pulse' : 'text-secondary'}`}>
              COST: {totalCost} / {necroStatus.maxCost}
            </span>
          </div>
        }
        borderColor={isOverCost ? 'blood' : 'iron'}
      >
        <div className="grid grid-cols-3 gap-1">
          {party.map((m, i) => (
            <button 
              key={i} 
              className={`h-12 border flex flex-col items-center justify-center p-0.5 transition-colors relative group
                ${m ? 'border-primary bg-primary/5 hover:bg-primary/10' : 'border-[#1A1A1A] border-dashed bg-black/40'}
              `}
              onClick={() => updatePartySlot(i, null)}
            >
              {m ? (
                <>
                  <span className="text-[9px] font-bold text-white truncate w-full text-center">{m.name}</span>
                  <div className="text-[7px] text-gray-500 font-mono">C{m.cost} | A{getEffectiveStats(m).atk}</div>
                  <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[8px] font-bold text-white">DISMISS</span>
                  </div>
                </>
              ) : (
                <span className="text-gray-700 font-bold text-[8px]">EMPTY</span>
              )}
            </button>
          ))}
        </div>
      </GameFrame>

      {/* Monster List */}
      <GameFrame title="CAPTURED SPIRITS" borderColor="iron" className="flex-1">
        <div className="flex flex-col gap-0.5 overflow-y-auto custom-scrollbar h-full min-h-[300px] pr-1">
          {inventoryMonsters.length === 0 && (
            <div className="text-center py-12 text-gray-700 text-[10px] italic">Void is empty.</div>
          )}
          {inventoryMonsters.map((m) => {
            const stats = getEffectiveStats(m);
            return (
              <div key={m.id} className="bg-[#0D0D0D] border border-transparent hover:border-[#2C2C2C] p-1.5 flex justify-between items-center gap-2 group transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-primary text-[10px] uppercase truncate">{m.name}</span>
                    <span className="text-[7px] text-gray-600 border border-[#1A1A1A] px-1 rounded uppercase tracking-tighter">{m.tribe}</span>
                  </div>
                  <div className="text-[8px] text-gray-500 font-mono mt-0.5">
                    COST: {m.cost} | ATK: {stats.atk} | MATK: {stats.matk}
                  </div>
                </div>
                <div className="flex gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEquippingMonsterId(m.id)}
                    className="p-1 border border-[#2C2C2C] text-gray-500 hover:text-secondary hover:border-secondary transition-colors"
                  >
                    <Shield size={10} />
                  </button>
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleSoulStone(m.id)}
                    className="p-1 border border-[#2C2C2C] text-gray-500 hover:text-red-500 hover:border-red-500 transition-colors"
                  >
                    <Sparkles size={10} />
                  </button>
                  <button 
                    onClick={() => {
                      const emptyIndex = party.findIndex(p => p === null);
                      if (emptyIndex !== -1) updatePartySlot(emptyIndex, m);
                    }}
                    className="px-2 py-0.5 text-[8px] font-bold border border-[#2C2C2C] text-gray-500 hover:bg-primary/10 hover:text-primary hover:border-primary transition-colors uppercase"
                  >
                    DEPLOY
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </GameFrame>
    </div>
  );
}
