'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import BattleCanvas from '../components/battle/BattleCanvas';
import NecroLab from '../components/necro/NecroLab';

export default function Home() {
  const { player, setPlayer, setNecroStatus, setInventoryMonsters, party } = useGameStore();
  const [isInBattle, setIsInBattle] = useState(false);

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
    }
  }, [player, setPlayer, setNecroStatus, setInventoryMonsters]);

  if (!player) return <div className="p-8 text-center">Loading Hero Data...</div>;

  return (
    <main className="min-h-screen bg-dark text-white p-4 font-mono">
      {!isInBattle ? (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="border-2 border-blood/50 p-6 bg-necro/20 backdrop-blur-sm rounded-lg shadow-[0_0_20px_rgba(136,8,8,0.2)]">
            <header className="mb-8 border-b border-blood/30 pb-4">
              <h1 className="text-3xl font-bold text-blood tracking-widest uppercase">ネクロマンス・ブレイブ - 拠点</h1>
            </header>

            <section className="grid grid-cols-2 gap-8 mb-12">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-l-4 border-blood pl-2">ステータス</h2>
                <div className="space-y-1 text-lg">
                  <p>NAME: <span className="text-blood">{player.name}</span></p>
                  <p>JOB: <span className="text-blood">{player.currentJobId.toUpperCase()}</span></p>
                  <div className="w-full bg-gray-800 h-2 mt-4 rounded-full overflow-hidden">
                     <div className="bg-red-600 h-full" style={{ width: `${(player.stats.hp / 100) * 100}%` }}></div>
                  </div>
                  <p className="text-sm text-right">HP: {player.stats.hp} / 100</p>
                  
                  <div className="w-full bg-gray-800 h-2 mt-2 rounded-full overflow-hidden">
                     <div className="bg-blue-600 h-full" style={{ width: `${(player.stats.mp / 20) * 100}%` }}></div>
                  </div>
                  <p className="text-sm text-right">MP: {player.stats.mp} / 20</p>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-l-4 border-blood pl-2">軍団編成</h2>
                <div className="grid grid-cols-3 gap-2">
                  {party.map((m, i) => (
                    <div key={i} className="aspect-square border border-blood/30 flex items-center justify-center bg-black/40 text-xs">
                      {m ? m.name : 'EMPTY'}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <button 
              onClick={() => setIsInBattle(true)}
              className="w-full py-4 bg-blood hover:bg-red-700 transition-colors text-xl font-bold tracking-tighter shadow-lg shadow-black/50 active:translate-y-1"
            >
              ワールドマップへ出撃
            </button>
          </div>

          <NecroLab />
        </div>
      ) : (
        <div className="relative">
          <BattleCanvas onEnd={() => setIsInBattle(false)} />
          <button 
            onClick={() => setIsInBattle(false)}
            className="absolute top-4 right-4 px-4 py-2 bg-black/50 border border-blood text-sm hover:bg-black"
          >
            撤退
          </button>
        </div>
      )}
    </main>
  );
}
