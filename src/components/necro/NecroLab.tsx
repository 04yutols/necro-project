'use client';

import { useState, useMemo } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { MonsterData } from '../../types/game';
import { soulStoneAction, updatePartyAction } from '../../app/actions';
import { Ghost, Skull, Sparkles, AlertTriangle } from 'lucide-react';

export default function NecroLab() {
  const { 
    player, 
    necroStatus, 
    party, 
    inventoryMonsters, 
    updatePartySlot, 
    removeMonster, 
    addSoulShard 
  } = useGameStore();

  const [isProcessing, setIsInProcessing] = useState(false);

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
        alert(`${result.data.originMonsterName}は魂の欠片になりました。`);
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

  if (!necroStatus) return <div className="text-blood">死霊術師の資格がありません。</div>;

  return (
    <div className="bg-dark/90 border-2 border-necro/50 p-6 rounded-xl shadow-2xl backdrop-blur-md max-w-4xl mx-auto font-mono text-gray-300">
      <header className="flex items-center gap-4 mb-8 border-b border-necro/30 pb-4">
        <Skull className="text-necro w-8 h-8" />
        <h1 className="text-2xl font-bold tracking-widest text-necro uppercase">死霊術研究所 (Necro-Lab)</h1>
      </header>

      {/* パーティ編成セクション */}
      <section className="mb-12">
        <div className="flex justify-between items-end mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Ghost className="w-5 h-5" /> 軍団編成
          </h2>
          <div className={`text-lg font-bold px-3 py-1 rounded border ${isOverCost ? 'bg-blood/20 border-blood text-red-500 animate-pulse' : 'bg-necro/20 border-necro text-necro'}`}>
            COST: {totalCost} / {necroStatus.maxCost}
            {isOverCost && <AlertTriangle className="inline ml-2 w-5 h-5" />}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {party.map((m, i) => (
            <div 
              key={i} 
              className={`aspect-[3/4] border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer
                ${m ? 'border-necro bg-necro/10 hover:bg-necro/20' : 'border-gray-700 hover:border-necro/50 bg-black/40'}
              `}
              onClick={() => handleSlotClick(i, null)}
            >
              {m ? (
                <>
                  <span className="text-xs text-necro mb-2">SLOT {i + 1}</span>
                  <div className="text-lg font-bold text-white">{m.name}</div>
                  <div className="text-xs mt-2 text-gray-400">COST: {m.cost}</div>
                </>
              ) : (
                <span className="text-gray-600">EMPTY SLOT</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* モンスターリスト */}
      <section>
        <h2 className="text-xl font-semibold mb-4 border-l-4 border-necro pl-3">ストックモンスター</h2>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-64 pr-2 custom-scrollbar">
          {inventoryMonsters.map((m) => (
            <div key={m.id} className="bg-black/60 border border-gray-800 p-3 rounded flex justify-between items-center group hover:border-necro/50 transition-colors">
              <div>
                <div className="font-bold text-white">{m.name} <span className="text-[10px] text-necro ml-2 px-1 border border-necro/30">{m.tribe}</span></div>
                <div className="text-xs text-gray-500">COST: {m.cost} | ATK: {m.stats.atk}</div>
              </div>
              <div className="flex gap-2">
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
                    if (emptyIndex !== -1) handleSlotClick(emptyIndex, m);
                  }}
                  className="px-3 py-1 bg-necro/20 hover:bg-necro border border-necro/50 text-necro hover:text-white rounded text-xs transition-all"
                >
                  配置
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {isOverCost && (
        <div className="mt-6 p-3 bg-blood/10 border border-blood text-red-400 text-sm flex items-center gap-3 rounded animate-bounce">
          <AlertTriangle className="shrink-0" />
          <span>軍団の合計コストが最大値を超えています。このままでは出撃できません。</span>
        </div>
      )}
    </div>
  );
}
