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
      <div className="w-full max-w-4xl aspect-[16/9] bg-black/40 border-2 border-secondary/30 rounded-xl p-8 shadow-[0_0_30px_rgba(0,255,171,0.1)] relative overflow-hidden flex flex-col">
        <h2 className="text-2xl font-bold font-cinzel text-center mb-4 tracking-widest text-secondary drop-shadow-[0_0_8px_rgba(0,255,171,0.5)] flex items-center justify-center gap-3 relative z-20 bg-dark/80 inline-block px-4 py-2 rounded-full self-center">
          <MapIcon /> AREA 1: BEGINNER'S PLAIN
        </h2>

        {/* Node Map Area */}
        <div className="relative flex-1 w-full z-10">
          {area1Stages.map((stage, index) => {
            const unlocked = isUnlocked(stage.id);
            const cleared = player.clearedStages.includes(stage.id);
            const isBoss = stage.isAreaBoss;
            
            // Hardcoded positions for nodes to make a non-linear map layout
            const positions = [
              { left: '10%', top: '70%' },
              { left: '45%', top: '40%' },
              { left: '80%', top: '20%' }
            ];
            
            const pos = positions[index] || { left: `${(index + 1) * 20}%`, top: '50%' };
            
            return (
              <div 
                key={stage.id} 
                className="absolute flex flex-col items-center gap-3 -translate-x-1/2 -translate-y-1/2 group"
                style={pos}
              >
                <motion.button 
                  whileHover={unlocked ? { scale: 1.15, rotate: 5 } : {}}
                  whileTap={unlocked ? { scale: 0.9, rotate: -5 } : {}}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  onClick={() => unlocked && setSelectedStageId(stage.id)}
                  disabled={!unlocked}
                  className={`w-24 h-24 rounded-3xl border-4 flex items-center justify-center transition-all duration-300 shadow-2xl border-b-8 active:border-b-0 active:translate-y-2
                    ${unlocked 
                      ? isBoss 
                        ? 'border-red-800 bg-blood text-white hover:shadow-[0_0_30px_#ff2e2e]' 
                        : 'border-emerald-800 bg-secondary text-dark hover:shadow-[0_0_30px_#00ffab]'
                      : 'border-gray-800 bg-black/80 text-gray-700 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  {cleared ? <CheckCircle2 size={40} /> : isBoss ? <Skull size={40} /> : <MapIcon size={36} />}
                </motion.button>
                <div className="text-center font-space bg-black/90 p-2 rounded-xl border-2 border-white/5 backdrop-blur-md shadow-xl group-hover:border-primary/50 transition-colors">
                  <div className={`text-[10px] font-black tracking-widest ${unlocked ? (isBoss ? 'text-blood' : 'text-secondary') : 'text-gray-600'}`}>
                    STAGE {stage.id.toUpperCase()}
                  </div>
                  <div className={`text-sm font-black ${unlocked ? 'text-white' : 'text-gray-700'} uppercase`}>
                    {unlocked ? stage.name : 'ENCRYPTED'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 出撃確認ダイアログ */}
        {selectedStage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedStageId(null)}
                    className="flex-1 py-3 border-4 border-white/5 bg-black/40 hover:border-white/10 transition-all font-black font-space rounded-2xl text-gray-400 border-b-8 active:border-b-0 active:translate-y-2"
                  >
                    CANCEL
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onStartStage(selectedStage.id)}
                    className="flex-1 py-3 bg-secondary text-dark font-black font-space rounded-2xl shadow-[0_0_30px_#00ffab] transition-all border-4 border-emerald-800 border-b-8 active:border-b-0 active:translate-y-2"
                  >
                    DEPLOY
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
