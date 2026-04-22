'use client';

import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map as MapIcon, Skull, ShieldAlert, Home, ChevronRight, X } from 'lucide-react';
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
      <div 
        className={`z-[100] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${selectedStage ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        onPointerDown={() => setSelectedStageId(null)}
      >
        <AnimatePresence>
          {selectedStage && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-[#090909]/95 border border-[#3C3C3C] shadow-[0_0_80px_rgba(0,0,0,1)] pointer-events-auto rounded-[32px] overflow-hidden backdrop-blur-3xl"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 flex flex-col gap-6 relative">
                {/* Background Decor in Panel */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

                {/* Close Button (X) */}
                <div 
                  role="button"
                  onPointerDown={() => setSelectedStageId(null)}
                  style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 50, width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.6)', border: '1px solid #3C3C3C', color: '#A0A0A0', cursor: 'pointer' }}
                >
                  <X size={20} strokeWidth={3} />
                </div>

                <div className="flex flex-col items-center text-center relative z-10 gap-3 pb-2">
                  <div className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center bg-black/80
                    ${selectedStage.isAreaBoss ? 'border-tertiary text-tertiary shadow-[0_0_30px_rgba(255,107,155,0.4)]' : 'border-primary text-primary shadow-[0_0_30px_rgba(188,0,251,0.4)]'}`}>
                    {selectedStage.isAreaBoss ? <Skull size={40} /> : <MapIcon size={40} />}
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-black text-primary tracking-[0.3em] uppercase mb-2 drop-shadow-[0_0_10px_rgba(188,0,251,0.8)]">
                      ステージ {selectedStage.id}
                    </div>
                    <div className="text-2xl font-black text-white tracking-widest uppercase leading-tight drop-shadow-md">
                      {selectedStage.name}
                    </div>
                  </div>
                  
                  <div className="flex justify-center items-center gap-3 mt-2 w-full">
                    <div className="flex justify-center items-center gap-1.5 text-secondary opacity-90 bg-secondary/15 px-4 py-2 rounded-lg border border-secondary/30">
                      <ShieldAlert size={14} />
                      <span className="text-[11px] font-black tracking-widest uppercase">推奨Lv 15</span>
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 tracking-widest bg-black/40 px-4 py-2 rounded-lg border border-[#2C2C2C]">出現敵: アンデッド</span>
                  </div>
                </div>

                <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-[#2C2C2C] to-transparent" />

                {/* Party Status Section */}
                <div className="flex flex-col gap-3 relative z-10">
                  <span className="text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase text-center">編成中の軍団</span>
                  <div className="grid grid-cols-3 gap-3">
                    {party.map((member, idx) => (
                      <div key={idx} className="bg-black/60 border border-[#222] p-3 rounded-xl flex flex-col items-center justify-center gap-2 aspect-square shadow-inner transition-all duration-300 hover:border-primary/50">
                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#FFFFFF', textAlign: 'center', width: '100%', letterSpacing: '0.1em', marginTop: '4px' }}>
                          {member ? member.name : '未配置'}
                        </span>
                        {member ? (
                          <div className="flex flex-col gap-1.5 w-full mt-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-[#8B0000] rotate-45" />
                              <div className="flex-1 h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                                <div className="h-full bg-[#8B0000]" style={{ width: `${(member.stats.hp / (member.stats as any).maxHp || 100) * 100}%` }} />
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 bg-[#2B4A78] rotate-45" />
                              <div className="flex-1 h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden">
                                <div className="h-full bg-[#2B4A78]" style={{ width: `${(member.stats.mp / 20) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-8 flex items-center justify-center opacity-20 text-[8px] font-bold tracking-widest">--</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3 mt-4 relative z-10 w-full">
                  <button 
                    onPointerDown={() => onStartStage(selectedStage.id)}
                    style={{ backgroundColor: '#BC00FB', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', height: '72px', width: '100%', borderRadius: '16px', fontSize: '24px', fontWeight: 900, boxShadow: '0 0 30px rgba(188,0,251,0.5)', border: '2px solid rgba(188,0,251,0.8)', letterSpacing: '0.2em' }}
                  >
                    出撃 <ChevronRight size={28} />
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