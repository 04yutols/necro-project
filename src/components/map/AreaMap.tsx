'use client';

import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map as MapIcon, Skull, ShieldAlert, CheckCircle2 } from 'lucide-react';
import stagesData from '../../data/master/stages.json';
import { motion, AnimatePresence } from 'framer-motion';

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

  const positions = [
    { x: 100, y: 350 },
    { x: 300, y: 200 },
    { x: 500, y: 250 },
    { x: 700, y: 150 }
  ];

  return (
    <div className="w-full h-full relative overflow-hidden bg-black/40 rounded-3xl border border-white/5">
      {/* SVG Connections Layer */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <path 
          d="M 100 350 L 300 200 L 500 250 L 700 150" 
          fill="none" 
          stroke="rgba(0, 255, 255, 0.2)" 
          strokeWidth="2" 
          strokeDasharray="8 4"
        />
      </svg>

      {/* Nodes Layer */}
      <div className="relative w-full h-full z-10">
        {area1Stages.map((stage, index) => {
          const unlocked = isUnlocked(stage.id);
          const cleared = player.clearedStages.includes(stage.id);
          const isBoss = stage.isAreaBoss;
          const pos = positions[index] || { x: (index + 1) * 150, y: 200 };
          
          return (
            <div 
              key={stage.id} 
              className="absolute flex flex-col items-center gap-3 -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: pos.x, top: pos.y }}
            >
              <motion.button 
                whileHover={unlocked ? { scale: 1.5 } : {}}
                whileTap={unlocked ? { scale: 0.9 } : {}}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                onClick={() => unlocked && setSelectedStageId(stage.id)}
                disabled={!unlocked}
                className={`w-4 h-4 rounded-full transition-all duration-300 relative
                  ${unlocked 
                    ? cleared
                      ? 'bg-secondary shadow-[0_0_15px_#00FFFF]'
                      : 'bg-primary shadow-[0_0_15px_#BC00FB]'
                    : 'bg-gray-800'
                  }
                `}
              >
                {unlocked && (
                  <div className="absolute -inset-2 bg-inherit opacity-20 rounded-full animate-ping" />
                )}
              </motion.button>
              
              <div className="text-center mt-2">
                <div className={`text-[8px] font-bold tracking-widest uppercase mb-0.5 ${unlocked ? 'text-gray-300' : 'text-gray-600'}`}>
                  {stage.id}
                </div>
                <div className={`text-[10px] font-black tracking-widest whitespace-nowrap ${unlocked ? 'text-white' : 'text-gray-700'}`}>
                  {unlocked ? stage.name : 'ENCRYPTED'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Refined Stage Detail Popup */}
      <AnimatePresence>
        {selectedStage && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-[340px] rounded-3xl shadow-2xl overflow-hidden relative">
              <div className="absolute inset-0 focus-lines opacity-10 pointer-events-none" />
              
              <div className="p-8 flex flex-col items-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-primary shadow-inner">
                  <Skull size={32} />
                </div>

                <div className="text-center">
                  <h3 className="text-xs font-bold text-gray-500 tracking-[0.3em] uppercase mb-2">Stage Selection</h3>
                  <div className="text-lg font-black text-white tracking-widest uppercase mb-1">{selectedStage.name}</div>
                  <div className="text-[10px] font-bold text-secondary tracking-widest uppercase">Rec Lvl: 15</div>
                </div>

                <div className="w-full flex flex-col gap-3 mt-2">
                  <FuchsiaButton 
                    onClick={() => onStartStage(selectedStage.id)}
                    className="w-full py-4 text-xs tracking-[0.3em]"
                  >
                    ENTER CRYPT
                  </FuchsiaButton>
                  <button 
                    onClick={() => setSelectedStageId(null)}
                    className="w-full py-2 text-[10px] font-bold text-gray-500 hover:text-white transition-colors tracking-widest uppercase"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

