'use client';

import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map as MapIcon, Skull, ShieldAlert, CheckCircle2 } from 'lucide-react';
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

  const area1Stages = stages.filter(s => s.area === 1);

  const isUnlocked = (stageId: string) => {
    if (stageId === '1-1') return true;
    if (stageId === '1-2') return player.clearedStages.includes('1-1');
    if (stageId === 'boss-1') return player.clearedStages.includes('1-2');
    return false;
  };

  const selectedStage = selectedStageId ? area1Stages.find(s => s.id === selectedStageId) : null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-black/40 border-2 border-secondary/30 rounded-xl p-8 shadow-[0_0_30px_rgba(0,255,171,0.1)] relative">
        <h2 className="text-2xl font-bold font-cinzel text-center mb-10 tracking-widest text-secondary drop-shadow-[0_0_8px_rgba(0,255,171,0.5)] flex items-center justify-center gap-3">
          <MapIcon /> AREA 1: BEGINNER'S PLAIN
        </h2>

        {/* Node Map Grid */}
        <div className="relative flex justify-between items-center px-8 z-10">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-16 right-16 h-1 bg-gray-800 -translate-y-1/2 z-0" />
          <div className="absolute top-1/2 left-16 right-16 h-1 bg-secondary/50 -translate-y-1/2 z-0 origin-left transition-transform duration-1000" style={{ transform: `scaleX(${player.clearedStages.length > 1 ? 1 : player.clearedStages.length > 0 ? 0.5 : 0})` }} />

          {area1Stages.map((stage, index) => {
            const unlocked = isUnlocked(stage.id);
            const cleared = player.clearedStages.includes(stage.id);
            const isBoss = stage.isAreaBoss;
            
            return (
              <div key={stage.id} className="relative z-10 flex flex-col items-center gap-4">
                <button 
                  onClick={() => unlocked && setSelectedStageId(stage.id)}
                  disabled={!unlocked}
                  className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 shadow-lg puni-puni
                    ${unlocked 
                      ? isBoss ? 'border-blood bg-blood/20 text-blood hover:bg-blood/40 hover:shadow-[0_0_20px_rgba(136,8,8,0.8)]' : 'border-secondary bg-secondary/20 text-secondary hover:bg-secondary/40 hover:shadow-[0_0_20px_rgba(0,255,171,0.8)]'
                      : 'border-gray-800 bg-black/80 text-gray-700 cursor-not-allowed'
                    }
                  `}
                >
                  {cleared ? <CheckCircle2 size={32} /> : isBoss ? <Skull size={32} /> : <MapIcon size={28} />}
                </button>
                <div className="text-center font-space">
                  <div className={`text-xs font-bold ${unlocked ? (isBoss ? 'text-blood' : 'text-secondary') : 'text-gray-600'}`}>
                    STAGE {stage.id.toUpperCase()}
                  </div>
                  <div className={`text-sm font-bold ${unlocked ? 'text-white' : 'text-gray-700'}`}>
                    {unlocked ? stage.name : 'LOCKED'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 出撃確認ダイアログ */}
        {selectedStage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="bg-dark border-2 border-secondary w-full max-w-md rounded-xl shadow-[0_0_50px_rgba(0,255,171,0.3)] overflow-hidden font-mono text-gray-300 animate-in zoom-in-95 duration-200">
              <header className="p-4 border-b border-secondary/30 flex justify-between items-center bg-secondary/10">
                <h3 className="text-lg font-bold font-cinzel text-white uppercase tracking-widest">SORTIE CONFIRMATION</h3>
              </header>
              <div className="p-6 space-y-6">
                <div>
                  <div className="text-secondary font-space text-sm font-bold mb-1">STAGE {selectedStage.id.toUpperCase()}</div>
                  <div className="text-2xl font-bold font-noto text-white">{selectedStage.name}</div>
                </div>
                
                <div className="bg-black/50 p-4 rounded border border-gray-800">
                  <div className="text-xs font-space text-gray-500 uppercase mb-2">Expected Difficulty</div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="text-yellow-500" size={16} />
                    <span className="text-yellow-500 font-bold font-noto">推奨レベル: {selectedStage.id === 'boss-1' ? '15' : '1〜5'}</span>
                  </div>
                </div>

                <div className="bg-black/50 p-4 rounded border border-gray-800">
                  <div className="text-xs font-space text-gray-500 uppercase mb-2">Enemy Intel</div>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(selectedStage.enemies.flat())].map((enemyId: any, idx) => (
                      <span key={idx} className="bg-secondary/10 border border-secondary/30 text-secondary px-2 py-1 rounded text-xs font-bold uppercase">
                        {enemyId}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setSelectedStageId(null)}
                    className="puni-puni flex-1 py-3 border-2 border-gray-700 hover:border-gray-500 hover:text-white transition-colors font-bold font-space rounded-lg"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={() => onStartStage(selectedStage.id)}
                    className="puni-puni flex-1 py-3 bg-secondary hover:bg-emerald-400 text-dark font-bold font-space rounded-lg shadow-[0_0_15px_rgba(0,255,171,0.5)] transition-all"
                  >
                    DEPLOY
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
