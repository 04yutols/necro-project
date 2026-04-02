'use client';

import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map, Skull, ArrowRight, ShieldAlert } from 'lucide-react';
import stagesData from '../../data/master/stages.json';

interface AreaMapProps {
  onStartStage: (stageId: string) => void;
}

export default function AreaMap({ onStartStage }: AreaMapProps) {
  const { player } = useGameStore();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  if (!player) return null;

  const stages = Object.entries(stagesData).map(([id, data]) => ({
    id,
    ...(data as any),
  }));

  // エリア1のステージをフィルタリング（拡張を見据えて）
  const area1Stages = stages.filter(s => s.area === 1);

  // 解禁条件の簡易ロジック
  const isUnlocked = (stageId: string) => {
    if (stageId === '1-1') return true;
    if (stageId === '1-2') return player.clearedStages.includes('1-1');
    if (stageId === 'boss-1') return player.clearedStages.includes('1-2');
    return false;
  };

  const selectedStage = selectedStageId ? area1Stages.find(s => s.id === selectedStageId) : null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-dark/80 border-2 border-blood/50 p-8 rounded-xl shadow-2xl relative">
        <h2 className="text-2xl font-bold text-center mb-8 tracking-widest text-blood uppercase flex items-center justify-center gap-3">
          <Map className="text-blood" /> エリア1：始まりの平原
        </h2>

        <div className="space-y-4 relative z-10">
          {area1Stages.map((stage) => {
            const unlocked = isUnlocked(stage.id);
            const cleared = player.clearedStages.includes(stage.id);
            
            return (
              <button 
                key={stage.id}
                onClick={() => unlocked && setSelectedStageId(stage.id)}
                disabled={!unlocked}
                className={`w-full p-6 border flex justify-between items-center rounded-lg transition-all
                  ${unlocked 
                    ? 'border-gray-700 hover:border-blood bg-black/60 hover:bg-blood/20 cursor-pointer group' 
                    : 'border-gray-900 bg-black/30 grayscale opacity-50 cursor-not-allowed'
                  }
                `}
              >
                <div className="text-left">
                  <div className={`text-sm font-bold ${unlocked ? 'text-blood' : 'text-gray-600'}`}>
                    STAGE {stage.id.toUpperCase()}
                  </div>
                  <div className={`text-xl font-bold ${unlocked ? 'group-hover:text-white text-gray-300' : 'text-gray-600'}`}>
                    {stage.name} {cleared && <span className="ml-2 text-xs bg-necro text-white px-2 py-1 rounded">CLEARED</span>}
                  </div>
                </div>
                {stage.isAreaBoss ? (
                  <Skull size={28} className={unlocked ? 'text-blood animate-pulse' : 'text-gray-800'} />
                ) : (
                  <ArrowRight size={24} className={unlocked ? 'text-gray-500 group-hover:text-blood' : 'text-gray-800'} />
                )}
              </button>
            );
          })}
        </div>

        {/* 出撃確認ダイアログ */}
        {selectedStage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-dark border-2 border-blood w-full max-w-md rounded-xl shadow-[0_0_50px_rgba(136,8,8,0.5)] overflow-hidden font-mono text-gray-300 animate-in zoom-in-95 duration-200">
              <header className="p-4 border-b border-blood/30 flex justify-between items-center bg-blood/10">
                <h3 className="text-lg font-bold text-white uppercase">出撃確認</h3>
              </header>
              <div className="p-6 space-y-6">
                <div>
                  <div className="text-blood text-sm font-bold mb-1">STAGE {selectedStage.id.toUpperCase()}</div>
                  <div className="text-2xl font-bold text-white">{selectedStage.name}</div>
                </div>
                
                <div className="bg-black/50 p-4 rounded border border-gray-800">
                  <div className="text-xs text-gray-500 uppercase mb-2">想定難易度</div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="text-yellow-500" size={16} />
                    <span className="text-yellow-500 font-bold">推奨レベル: {selectedStage.id === 'boss-1' ? '15' : '1〜5'}</span>
                  </div>
                </div>

                <div className="bg-black/50 p-4 rounded border border-gray-800">
                  <div className="text-xs text-gray-500 uppercase mb-2">出現モンスター</div>
                  <div className="flex flex-wrap gap-2">
                    {/* 一意のモンスター名を抽出して表示 */}
                    {[...new Set(selectedStage.enemies.flat())].map((enemyId: any, idx) => (
                      <span key={idx} className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-xs">
                        {enemyId}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setSelectedStageId(null)}
                    className="flex-1 py-3 border border-gray-700 hover:bg-gray-800 transition-colors font-bold rounded"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={() => onStartStage(selectedStage.id)}
                    className="flex-1 py-3 bg-blood hover:bg-red-700 transition-colors font-bold text-white rounded shadow-lg shadow-blood/20"
                  >
                    出撃する
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
