'use client';

import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map as MapIcon, Skull, ShieldAlert, Home, ChevronRight } from 'lucide-react';
import stagesData from '../../data/master/stages.json';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const MapCanvas = dynamic(() => import('./MapCanvas').then((mod) => mod.default), { 
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center w-full h-full bg-[#050505] text-primary text-[10px] animate-pulse uppercase tracking-widest">Loading Map Interface...</div>
});

interface AreaMapProps {
  onStartStage: (stageId: string) => void;
}

export default function AreaMap({ onStartStage }: AreaMapProps) {
  const { player, setCurrentTab, party } = useGameStore();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const stages = useMemo(() => Object.entries(stagesData).map(([id, data]) => ({
    id,
    ...(data as any),
  })), []);

  const area1Stages = stages.filter(s => s.area === 1);
  const selectedStage = selectedStageId ? area1Stages.find(s => s.id === selectedStageId) : null;

  if (!isMounted || !player) return null;

  return (
    <div className="w-full h-full flex flex-col relative bg-[#050505] overflow-hidden rounded-xl border border-[#1A1A1A]">
      {/* Absolute Background Canvas (PixiJS) */}
      <div className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }}>
        <MapCanvas 
          stages={stages}
          clearedStages={player.clearedStages}
          onSelectStage={setSelectedStageId}
          selectedStageId={selectedStageId}
        />
      </div>

      {/* Top Header UI */}
      <div className="relative z-10 pt-4 px-4 pointer-events-none">
        <div className="flex items-center mb-3 pointer-events-auto">
          <button 
            onClick={() => setCurrentTab('HOME')}
            className="flex items-center gap-2 text-gray-400 hover:text-primary transition-colors text-[10px] font-black tracking-widest uppercase bg-black/60 border border-[#1A1A1A] px-3 py-1.5 rounded-md backdrop-blur-md shadow-md"
          >
            <Home size={14} />
            <span>RETURN TO HUB</span>
          </button>
        </div>

        <div className="flex justify-between items-start border border-[#2C2C2C] bg-black/60 p-4 rounded-xl shadow-lg backdrop-blur-md pointer-events-auto">
          <div className="space-y-1.5">
            <h2 className="text-sm font-black text-white tracking-widest uppercase">
              Abyssal Sector 04
            </h2>
            <div className="flex items-center gap-2 opacity-80">
              <div className="text-[9px] font-black text-secondary tracking-widest uppercase">
                SYNC: 94%
              </div>
              <div className="h-1.5 w-20 bg-black/80 rounded-full overflow-hidden border border-[#1A1A1A]">
                <div className="h-full bg-secondary shadow-[0_0_8px_#00FFFF]" style={{ width: '94%' }} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 px-2 py-0.5 rounded border border-[#2C2C2C] bg-[#0D0D0D]">
              <span className="text-[8px] font-black text-gray-500 tracking-widest">GOLD</span>
              <span className="text-[10px] font-black text-[#D4AF37] tracking-widest">4,200</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-0.5 rounded border border-[#2C2C2C] bg-[#0D0D0D]">
              <span className="text-[8px] font-black text-gray-500 tracking-widest">RYUGIN</span>
              <span className="text-[10px] font-black text-primary tracking-widest">12</span>
            </div>
          </div>
        </div>
      </div>

      {/* Central Popup Panel */}
      <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] transition-all" style={{ opacity: selectedStage ? 1 : 0 }}>
        <AnimatePresence>
          {selectedStage && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-sm bg-[#0D0D0D]/95 border border-[#3C3C3C] shadow-[0_0_50px_rgba(0,0,0,0.9)] pointer-events-auto rounded-2xl overflow-hidden backdrop-blur-xl"
            >
              <div className="p-5 flex flex-col gap-4 relative">
                {/* Background Decor in Panel */}
                <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center bg-black
                      ${selectedStage.isAreaBoss ? 'border-tertiary text-tertiary shadow-[0_0_15px_rgba(255,107,155,0.3)]' : 'border-primary text-primary shadow-[0_0_15px_rgba(188,0,251,0.3)]'}`}>
                      {selectedStage.isAreaBoss ? <Skull size={28} /> : <MapIcon size={28} />}
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase mb-1">
                        STAGE {selectedStage.id}
                      </div>
                      <div className="text-lg font-black text-white tracking-widest uppercase leading-none drop-shadow-md">
                        {selectedStage.name}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1 text-right">
                    <div className="flex items-center gap-1 text-secondary opacity-80 bg-secondary/10 px-2 py-1 rounded border border-secondary/20">
                      <ShieldAlert size={10} />
                      <span className="text-[10px] font-black tracking-widest uppercase">REC. LV 15</span>
                    </div>
                    <span className="text-[9px] font-bold text-gray-600 tracking-widest">ENEMIES: UNDEAD</span>
                  </div>
                </div>

                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#2C2C2C] to-transparent my-1" />

                {/* Party Status Section */}
                <div className="flex flex-col gap-2 relative z-10">
                  <span className="text-[8px] font-black text-gray-500 tracking-[0.2em] uppercase">Current Legion</span>
                  <div className="grid grid-cols-3 gap-2">
                    {party.map((member, idx) => (
                      <div key={idx} className="bg-black/50 border border-[#1A1A1A] p-2 rounded-lg flex flex-col gap-1">
                        <span className="text-[8px] font-black text-white truncate uppercase tracking-widest">
                          {member ? member.name : 'EMPTY'}
                        </span>
                        {member ? (
                          <div className="flex flex-col gap-0.5 mt-0.5">
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-[#8B0000]" />
                              <div className="flex-1 h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                                <div className="h-full bg-[#8B0000]" style={{ width: `${(member.stats.hp / (member.stats as any).maxHp || 100) * 100}%` }} />
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-[#2B4A78]" />
                              <div className="flex-1 h-1 bg-[#1A1A1A] rounded-full overflow-hidden">
                                <div className="h-full bg-[#2B4A78]" style={{ width: `${(member.stats.mp / 20) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-3.5 flex items-center justify-center opacity-30 text-[7px] font-bold tracking-widest">--</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-2 relative z-10">
                  <button 
                    onClick={() => setSelectedStageId(null)}
                    className="px-6 py-4 text-[10px] font-black text-gray-400 hover:text-white transition-colors tracking-widest uppercase bg-[#1A1A1A] rounded-xl border border-[#2C2C2C]"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={() => onStartStage(selectedStage.id)}
                    className="flex-1 flex justify-center items-center gap-2 py-4 text-[12px] font-black tracking-[0.2em] rounded-xl uppercase bg-primary text-white hover:bg-primary/80 transition-colors shadow-[0_0_20px_rgba(188,0,251,0.5)] border border-primary/50"
                  >
                    <span>INITIATE SORTIE</span>
                    <ChevronRight size={16} className="animate-pulse" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}