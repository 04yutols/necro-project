'use client';

import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map as MapIcon, Skull, ShieldAlert, CheckCircle2 } from 'lucide-react';
import stagesData from '../../data/master/stages.json';
import { motion, AnimatePresence } from 'framer-motion';
import { FuchsiaButton } from '../ui/FuchsiaButton';

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
  
  console.log("Current selectedStageId:", selectedStageId);
  console.log("Found selectedStage:", selectedStage?.name);

  const positions = [
    { x: '15%', y: '75%' },
    { x: '40%', y: '45%' },
    { x: '65%', y: '55%' },
    { x: '85%', y: '30%' }
  ];

  return (
    <div className="w-full h-full flex flex-col gap-6">
      {/* Map Header - Sector Info */}
      <div className="flex justify-between items-center px-2">
        <div>
          <h2 className="text-2xl font-black text-white tracking-[0.1em] uppercase mb-1">
            ABYSSAL SECTOR 04
          </h2>
          <div className="text-[10px] font-bold text-secondary tracking-widest uppercase opacity-80">
            Map Synchronization: 94%
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-secondary/30 bg-secondary/5">
          <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          <span className="text-[9px] font-bold text-secondary tracking-widest uppercase">System Online</span>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 w-full relative overflow-hidden bg-black/40 rounded-3xl border border-white/5 shadow-inner min-h-[400px]">
        {/* SVG Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path 
            d="M 15 75 L 40 45 L 65 55 L 85 30" 
            fill="none" 
            stroke="rgba(0, 255, 255, 0.2)" 
            strokeWidth="0.5" 
            strokeDasharray="2 1"
          />
        </svg>

        {/* Nodes Layer */}
        <div className="relative w-full h-full z-10">
          {area1Stages.map((stage, index) => {
            const unlocked = isUnlocked(stage.id);
            const cleared = player.clearedStages.includes(stage.id);
            const isBoss = (stage as any).isAreaBoss;
            const pos = positions[index] || { x: `${(index + 1) * 20}%`, y: '50%' };
            
            return (
              <div 
                key={stage.id} 
                className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 group z-30"
                style={{ left: pos.x, top: pos.y }}
              >
                {/* Node Icon Button */}
                <motion.button 
                  whileHover={unlocked ? { scale: 1.2, y: -5 } : {}}
                  whileTap={unlocked ? { scale: 0.9 } : {}}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }}
                  onClick={() => {
                    console.log("ICON CLICKED:", stage.id, "unlocked:", unlocked);
                    if (unlocked) {
                      setSelectedStageId(stage.id);
                    }
                  }}
                  disabled={!unlocked}
                  className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 relative shadow-2xl pointer-events-auto
                    ${unlocked 
                      ? cleared
                        ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_20px_rgba(0,255,255,0.4)]'
                        : isBoss
                          ? 'bg-fuchsia/20 border-fuchsia text-fuchsia shadow-[0_0_20px_rgba(255,0,255,0.4)]'
                          : 'bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(188,0,251,0.4)]'
                      : 'bg-gray-900 border-gray-800 text-gray-700'
                    }
                  `}
                >
                  {cleared ? <CheckCircle2 size={24} /> : isBoss ? <Skull size={24} /> : <MapIcon size={24} />}
                  
                  {unlocked && !cleared && (
                    <div className="absolute -inset-1 border border-inherit rounded-2xl animate-pulse opacity-50" />
                  )}
                </motion.button>
                
                <div className="text-center mt-3 pointer-events-none">
                  <div className={`text-[9px] font-black tracking-[0.2em] uppercase mb-0.5 ${unlocked ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stage.id}
                  </div>
                  <div className={`text-[11px] font-black tracking-widest whitespace-nowrap drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] ${unlocked ? 'text-white' : 'text-gray-700'}`}>
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
              key="stage-detail-popup"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
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
                      onClick={() => {
                        console.log("ENTER CRYPT button clicked for:", selectedStage.id);
                        onStartStage(selectedStage.id);
                      }}
                      className="w-full py-4 text-xs tracking-[0.3em]"
                    >
                      ENTER CRYPT
                    </FuchsiaButton>
                    <button 
                      onClick={() => {
                        console.log("Cancel clicked");
                        setSelectedStageId(null);
                      }}
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
    </div>
  );
}
