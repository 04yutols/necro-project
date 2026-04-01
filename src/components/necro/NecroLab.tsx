'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MonsterData } from '../../types/game';
import { soulStoneAction, updatePartyAction } from '../../app/actions';
import { Ghost, Skull, Sparkles, AlertTriangle, Shield } from 'lucide-react';
import ShardEquipModal from './ShardEquipModal';

export default function NecroLab() {
  const { 
    player, 
    necroStatus, 
    party, 
    inventoryMonsters, 
    soulShards,
    updatePartySlot, 
    removeMonster, 
    addSoulShard 
  } = useGameStore();

  const [isProcessing, setIsInProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [equippingMonster, setEquippingMonster] = useState<MonsterData | null>(null);

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
    // 簡易的な入れ替えロジック
    // 本来はドラッグ＆ドロップや選択モードが必要
    updatePartySlot(slotIndex, monster);
  };

  const getEffectiveStats = (monster: MonsterData) => {
    const shard = soulShards.find(s => s.id === monster.equippedShardId);
    return {
      atk: monster.stats.atk + (shard?.effect.atkBonus || 0),
      matk: monster.stats.matk + (shard?.effect.matkBonus || 0),
    };
  };

  if (!necroStatus) return <div className="text-blood text-center p-8 border-2 border-blood/20 rounded-xl bg-blood/5 font-bold uppercase tracking-widest animate-pulse">死霊術師の資格がありません。</div>;

  return (
    <div className="bg-dark/90 border-2 border-necro/50 p-6 rounded-xl shadow-2xl backdrop-blur-md max-w-4xl mx-auto font-mono text-gray-300">
      <header className="flex items-center gap-4 mb-8 border-b border-necro/30 pb-4">
        <Skull className="text-necro w-8 h-8" />
        <h1 className="text-2xl font-bold tracking-widest text-necro uppercase">死霊術研究所 (Necro-Lab)</h1>
      </header>

      {/* 通知ポップアップ */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-blood border-2 border-red-500 text-white px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(136,8,8,0.5)] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold">{notification}</span>
          </div>
        </div>
      )}

      {/* パーティ編成セクション */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Ghost className="w-5 h-5" /> 軍団編成
          </h2>
          <div className={`text-lg font-bold px-3 py-1 rounded border transition-colors ${isOverCost ? 'bg-blood/20 border-blood text-red-500 animate-pulse' : 'bg-necro/20 border-necro text-necro'}`}>
            COST: {totalCost} / {necroStatus.maxCost}
            {isOverCost && <AlertTriangle className="inline ml-2 w-5 h-5" />}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {party.map((m, i) => (
            <div 
              key={i} 
              className={`aspect-[3/4] border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer
                ${m ? 'border-necro bg-necro/10 hover:bg-necro/20 shadow-[inset_0_0_20px_rgba(168,85,247,0.1)]' : 'border-gray-700 hover:border-necro/50 bg-black/40'}
              `}
              onClick={() => handleSlotClick(i, null)}
            >
              {m ? (
                <>
                  <span className="text-xs text-necro mb-2 font-bold uppercase">SLOT {i + 1}</span>
                  <div className="text-lg font-bold text-white text-center px-2">{m.name}</div>
                  <div className="text-xs mt-2 text-gray-400">COST: {m.cost}</div>
                  <div className="text-[10px] mt-1 text-green-400 font-bold">ATK: {getEffectiveStats(m).atk}</div>
                  {m.equippedShardId && <Sparkles size={12} className="text-necro mt-2 animate-pulse" />}
                </>
              ) : (
                <span className="text-gray-600 font-bold uppercase tracking-widest text-xs">Empty Slot</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* モンスターリスト */}
      <section>
        <h2 className="text-xl font-semibold mb-4 border-l-4 border-necro pl-3 uppercase tracking-wider">ストックモンスター</h2>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-64 pr-2 custom-scrollbar">
          {inventoryMonsters.map((m) => {
            const stats = getEffectiveStats(m);
            return (
              <div key={m.id} className="bg-black/60 border border-gray-800 p-3 rounded flex justify-between items-center group hover:border-necro/50 transition-colors">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    {m.name} 
                    <span className="text-[10px] text-necro px-1 border border-necro/30 uppercase">{m.tribe}</span>
                    {m.equippedShardId && <Sparkles size={12} className="text-necro animate-pulse" />}
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">
                    COST: {m.cost} | ATK: <span className={m.equippedShardId ? "text-green-400 font-bold" : ""}>{stats.atk}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log("Equip button clicked for monster:", m.id);
                      setEquippingMonster(m);
                    }}
                    className="p-2 bg-gray-900 hover:bg-necro/20 border border-gray-700 hover:border-necro text-gray-500 hover:text-necro rounded transition-all cursor-pointer z-10"
                    title="欠片を装備"
                  >
                    <Shield size={16} />
                  </button>
                  <button 
                    disabled={isProcessing}
                    onClick={() => handleSoulStone(m.id)}
                    className="p-2 bg-gray-900 hover:bg-blood/20 border border-gray-700 hover:border-blood text-gray-500 hover:text-blood rounded transition-all tooltip"
                    title="魂石化"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      const emptyIndex = party.findIndex(p => p === null);
                      if (emptyIndex !== -1) {
                        handleSlotClick(emptyIndex, m);
                      } else {
                        showNotification('軍団の枠がいっぱいです。配置を解除してから再度試してください');
                      }
                    }}
                    className="px-3 py-1 bg-necro/20 hover:bg-necro border border-necro/50 text-necro hover:text-white rounded text-xs transition-all font-bold uppercase"
                  >
                    配置
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 装備モーダル */}
      {equippingMonster && (
        <ShardEquipModal 
          monster={equippingMonster} 
          onClose={() => setEquippingMonster(null)} 
        />
      )}

      {isOverCost && (
        <div className="mt-6 p-3 bg-blood/10 border border-blood text-red-400 text-sm flex items-center gap-3 rounded animate-bounce">
          <AlertTriangle className="shrink-0" />
          <span>軍団の合計コストが最大値を超えています。このままでは出撃できません。</span>
        </div>
      )}
    </div>
  );
}
