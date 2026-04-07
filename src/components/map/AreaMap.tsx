'use client';

import { useState, useMemo } from 'react';
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

  const stages = useMemo(() => Object.entries(stagesData).map(([id, data]) => ({
    id,
    ...(data as any),
  })), []);

  const area1Stages = stages.filter(s => s.area === 1);

  const isUnlocked = (stageId: string) => {
    if (stageId === '1-1') return true;
    if (stageId === '1-2') return player.clearedStages.includes('1-1');
    if (stageId === 'boss-1') return player.clearedStages.includes('1-2');
    return false;
  };

  const positions = [
    { x: '15%', y: '70%' },
    { x: '45%', y: '40%' },
    { x: '80%', y: '25%' }
  ];

  const selectedStage = selectedStageId ? area1Stages.find(s => s.id === selectedStageId) : null;

  return (
    <div className="w-full h-full flex flex-col gap-6">
      {/* Map Header - Sector Info */}
      <div className="flex justify-between items-center px-2">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-white tracking-[0.1em] uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            ABYSSAL SECTOR 04
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-[10px] font-bold text-secondary tracking-[0.2em] uppercase opacity-80">
              Map Synchronization: 94%
            </div>
            <div className="h-1 w-24 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <div className="h-full bg-secondary shadow-[0_0_8px_#00FFFF]" style={{ width: '94%' }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-secondary/30 bg-secondary/5 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_#00FFFF]" />
          <span className="text-[10px] font-black text-secondary tracking-[0.2em] uppercase">System Online</span>
        </div>
      </div>

      {/* Main Map Area */}
      <div className="flex-1 w-full relative overflow-hidden bg-black/60 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-sm min-h-[450px]">
        {/* SVG Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 100 100" preserveAspectRatio="none">
          <motion.path 
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            d="M 15 70 L 45 40 L 80 25" 
            fill="none" 
            stroke="rgba(0, 255, 255, 0.3)" 
            strokeWidth="0.4" 
            strokeDasharray="2 1"
          />
        </svg>

        {/* Nodes Layer */}
        <div className="absolute inset-0 z-10">
          {area1Stages.map((stage, index) => {
            const unlocked = isUnlocked(stage.id);
            const cleared = player.clearedStages.includes(stage.id);
            const isBoss = (stage as any).isAreaBoss;
            const pos = positions[index] || { x: `${(index + 1) * 25}%`, y: '50%' };
            
            return (
              <div 
                key={stage.id} 
                className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 group z-20"
                style={{ left: pos.x, top: pos.y }}
              >
                {/* Node Button Container */}
                <div className="relative">
                  {unlocked && !cleared && (
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`absolute inset-0 rounded-full blur-md ${isBoss ? 'bg-fuchsia' : 'bg-primary'}`}
                    />
                  )}
                  
                  <motion.button 
                    whileHover={unlocked ? { scale: 1.2, y: -5 } : {}}
                    whileTap={unlocked ? { scale: 0.9 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    onClick={() => {
                      console.log("STAGE CLICKED:", stage.id);
                      if (unlocked) {
                        setSelectedStageId(stage.id);
                      }
                    }}
                    disabled={!unlocked}
                    className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 relative shadow-2xl z-10
                      ${unlocked 
                        ? cleared
                          ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_25px_rgba(0,255,255,0.5)]'
                          : isBoss
                            ? 'bg-fuchsia/20 border-fuchsia text-fuchsia shadow-[0_0_25px_rgba(255,0,255,0.5)]'
                            : 'bg-primary/20 border-primary text-primary shadow-[0_0_25px_rgba(188,0,251,0.5)]'
                        : 'bg-gray-900/80 border-gray-800 text-gray-700 opacity-50'
                      }
                    `}
                  >
                    {cleared ? <CheckCircle2 size={32} /> : isBoss ? <Skull size={32} /> : <MapIcon size={32} />}
                  </motion.button>
                </div>
                
                <div className="text-center mt-4 pointer-events-none">
                  <div className={`text-[10px] font-black tracking-[0.3em] uppercase mb-1 drop-shadow-lg ${unlocked ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stage.id}
                  </div>
                  <div className={`text-xs font-black tracking-[0.1em] whitespace-nowrap drop-shadow-[0_0_10px_rgba(0,0,0,1)] ${unlocked ? 'text-white' : 'text-gray-700'} uppercase`}>
                    {unlocked ? stage.name : 'ENCRYPTED DATA'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stage Selection Popup */}
        <AnimatePresence>
          {selectedStage && (
            <motion.div 
              key="stage-detail-popup"
              initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
              exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-[#050505] border border-white/10 w-full max-w-[360px] rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative"
              >
                <div className="absolute inset-0 focus-lines opacity-10 pointer-events-none" />
                <div className="absolute inset-0 honeycomb-grid opacity-5 pointer-events-none" />
                
                <div className="p-10 flex flex-col items-center gap-8 relative z-10">
                  <div className={`w-20 h-20 rounded-3xl border-2 flex items-center justify-center shadow-inner
                    ${selectedStage.isAreaBoss ? 'bg-fuchsia/10 border-fuchsia text-fuchsia shadow-[0_0_20px_rgba(255,0,255,0.2)]' : 'bg-primary/10 border-primary text-primary shadow-[0_0_20px_rgba(188,0,251,0.2)]'}`}>
                    {selectedStage.isAreaBoss ? <Skull size={40} /> : <MapIcon size={40} />}
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-[10px] font-bold text-gray-500 tracking-[0.4em] uppercase">Mission Briefing</h3>
                    <div className="text-xl font-black text-white tracking-[0.1em] uppercase leading-tight">{selectedStage.name}</div>
                    <div className="flex items-center justify-center gap-2 text-secondary">
                      <ShieldAlert size={12} />
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Rec Lvl: 15</span>
                    </div>
                  </div>

                  <div className="w-full flex flex-col gap-4">
                    <FuchsiaButton 
                      onClick={() => {
                        console.log("INITIATING SORTIE:", selectedStage.id);
                        onStartStage(selectedStage.id);
                      }}
                      className="w-full py-5 text-xs tracking-[0.4em] rounded-full"
                    >
                      INITIATE SORTIE
                    </FuchsiaButton>
                    <button 
                      onClick={() => setSelectedStageId(null)}
                      className="w-full py-2 text-[10px] font-bold text-gray-500 hover:text-white transition-colors tracking-[0.3em] uppercase"
                    >
                      Abort Mission
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
