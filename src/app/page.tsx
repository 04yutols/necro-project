'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import BattleCanvas from '../components/battle/BattleCanvas';
import NecroLab from '../components/necro/NecroLab';
import { Skull, Map, Shield, Activity } from 'lucide-react';

import ShardEquipModal from '../components/necro/ShardEquipModal';

import AreaMap from '../components/map/AreaMap';

export default function Home() {
  const { player, setPlayer, setNecroStatus, setInventoryMonsters, party, equippingMonsterId, inventoryMonsters: allMonsters, setEquippingMonsterId, addClearedStage } = useGameStore();
  const [isInBattle, setIsInBattle] = useState(false);
  const [activeTab, setActiveTab] = useState<'HUB' | 'LAB' | 'MAP'>('HUB');
  const [activeStageId, setActiveStageId] = useState<string | null>(null);

  const equippingMonster = equippingMonsterId ? allMonsters.find(m => m.id === equippingMonsterId) : null;

  useEffect(() => {
    // モックデータの初期化
    if (!player) {
      setPlayer({
        id: '1',
        name: 'アルド',
        currentJobId: 'warrior',
        category: 'PHYSICAL',
        stats: { hp: 100, mp: 20, atk: 50, def: 30, matk: 10, mdef: 10, agi: 10, luck: 10, tec: 20 },
        passives: { passiveAtkBonus: 0, passiveDefBonus: 0, passiveMatkBonus: 0, passiveMdefBonus: 0 },
        jobs: [],
        isAwakened: false,
        clearedStages: [],
      });


      setNecroStatus({
        level: 1,
        rank: 1,
        maxCost: 10,
        baseStatsBonus: 1.0,
      });

      setInventoryMonsters([
        { id: 'm1', name: 'ゴブリン', tribe: 'HUMANOID', cost: 3, stats: { hp: 50, mp: 0, atk: 10, def: 5, matk: 0, mdef: 2, agi: 5, luck: 5, tec: 5 } },
        { id: 'm2', name: 'スケルトン', tribe: 'UNDEAD', cost: 4, stats: { hp: 40, mp: 0, atk: 12, def: 8, matk: 0, mdef: 2, agi: 5, luck: 0, tec: 8 } },
        { id: 'm3', name: 'ゾンビ', tribe: 'UNDEAD', cost: 4, stats: { hp: 80, mp: 0, atk: 8, def: 4, matk: 0, mdef: 0, agi: 2, luck: 2, tec: 2 } },
      ]);

      // 初期状態で欠片を一つ持たせる
      const { addSoulShard } = useGameStore.getState();
      addSoulShard({
        id: 'initial-shard-1',
        originMonsterName: 'ゴブリン',
        effect: { atkBonus: 2, matkBonus: 0 }
      });
    }
  }, [player, setPlayer, setNecroStatus, setInventoryMonsters]);

  if (!player) return <div className="p-8 text-center bg-dark min-h-screen">Loading Hero Data...</div>;

  return (
    <main className="min-h-screen bg-dark text-white font-mono flex flex-col">
      {/* ナビゲーションバー */}
      <nav className="bg-black/80 border-b border-blood/30 p-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-blood tracking-tighter uppercase">Necromance Brave</h1>
          <div className="flex gap-6">
            <button onClick={() => setActiveTab('HUB')} className={`flex items-center gap-2 ${activeTab === 'HUB' ? 'text-blood' : 'text-gray-500 hover:text-white'}`}>
              <Shield size={18} /> 拠点
            </button>
            <button onClick={() => setActiveTab('LAB')} className={`flex items-center gap-2 ${activeTab === 'LAB' ? 'text-blood' : 'text-gray-500 hover:text-white'}`}>
              <Skull size={18} /> 研究所
            </button>
            <button onClick={() => setActiveTab('MAP')} className={`flex items-center gap-2 ${activeTab === 'MAP' ? 'text-blood' : 'text-gray-500 hover:text-white'}`}>
              <Map size={18} /> 出撃
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 p-4 overflow-y-auto">
        {!isInBattle ? (
          <div className="max-w-4xl mx-auto py-4">
            {activeTab === 'HUB' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                <section className="border-2 border-blood/50 p-6 bg-necro/10 rounded-lg shadow-lg">
                  <h2 className="text-xl font-bold border-l-4 border-blood pl-3 mb-6 uppercase flex items-center gap-2">
                    <Activity size={20} className="text-blood" /> ステータス
                  </h2>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <span className="text-gray-400">NAME:</span>
                      <span className="text-2xl font-bold text-white">{player.name}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-gray-800 pb-2">
                      <span className="text-gray-400">JOB:</span>
                      <span className="text-blood font-bold">{player.currentJobId.toUpperCase()}</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>HP</span>
                        <span>{player.stats.hp} / 100</span>
                      </div>
                      <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden border border-gray-800">
                        <div className="bg-red-600 h-full transition-all duration-1000" style={{ width: `${(player.stats.hp / 100) * 100}%` }}></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>MP</span>
                        <span>{player.stats.mp} / 20</span>
                      </div>
                      <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden border border-gray-800">
                        <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${(player.stats.mp / 20) * 100}%` }}></div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="border-2 border-blood/50 p-6 bg-black/40 rounded-lg shadow-lg">
                  <h2 className="text-xl font-bold border-l-4 border-blood pl-3 mb-6 uppercase flex items-center gap-2">
                    <Skull size={20} className="text-blood" /> 現在の軍団
                  </h2>
                  <div className="grid grid-cols-1 gap-3">
                    {party.map((m, i) => (
                      <div key={i} className={`p-3 border ${m ? 'border-necro bg-necro/10' : 'border-dashed border-gray-800 bg-black/20'} rounded flex items-center justify-between`}>
                        {m ? (
                          <>
                            <div>
                              <div className="font-bold">{m.name}</div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-tighter">{m.tribe}</div>
                            </div>
                            <div className="text-necro font-bold">COST {m.cost}</div>
                          </>
                        ) : (
                          <div className="text-gray-700 italic text-sm">空きスロット</div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'LAB' && (
              <div className="duration-300">
                <NecroLab />
              </div>
            )}

            {activeTab === 'MAP' && (
              <div className="duration-300">
                <AreaMap onStartStage={(stageId) => {
                  setActiveStageId(stageId);
                  setIsInBattle(true);
                }} />
              </div>
            )}
          </div>
        ) : (
          <div className="relative pt-8 animate-in zoom-in-95 duration-500">
            <BattleCanvas onEnd={() => {
              setIsInBattle(false);
              if (activeStageId) {
                addClearedStage(activeStageId);
              }
            }} />
            <button
              onClick={() => setIsInBattle(false)}
              className="fixed top-20 right-8 px-6 py-2 bg-blood hover:bg-red-700 border border-red-500 font-bold text-sm transition-all shadow-lg rounded"
            >
              撤退
            </button>
          </div>
        )}
      </div>

      {equippingMonster && (
        <ShardEquipModal 
          monster={equippingMonster} 
          onClose={() => setEquippingMonsterId(null)} 
        />
      )}
    </main>
  );
}
