'use client';

import { useState, useMemo, useEffect } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map as MapIcon, Skull, Home, ChevronRight, X, Search, ChevronLeft } from 'lucide-react';
import stagesData from '../../data/master/stages.json';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const MapCanvas = dynamic(() => import('./MapCanvas').then((mod) => mod.default), { 
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center w-full h-full bg-[#111] text-primary text-xs animate-pulse tracking-widest">Loading Map Interface...</div>
});

interface AreaMapProps {
  onStartStage: (stageId: string) => void;
}

export default function AreaMap({ onStartStage }: AreaMapProps) {
  const { player, setCurrentTab, party } = useGameStore();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'SORTIE' | 'INTEL'>('SORTIE');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (selectedStageId) setViewMode('SORTIE');
  }, [selectedStageId]);

  const stages = useMemo(() => Object.entries(stagesData).map(([id, data]) => ({ id, ...(data as any) })), []);
  const area1Stages = stages.filter(s => s.area === 1);
  const selectedStage = selectedStageId ? area1Stages.find(s => s.id === selectedStageId) : null;

  if (!isMounted || !player) return null;

  const currentCost = party.reduce((sum, monster) => sum + (monster ? monster.cost : 0), 0);
  const maxCost = 45; 

  return (
    <div className="w-full h-full flex flex-col relative bg-[#111] overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Absolute Background Canvas */}
      <div className="absolute inset-0 z-0" style={{ width: '100%', height: '100%' }}>
        <MapCanvas 
          stages={stages}
          clearedStages={player.clearedStages}
          onSelectStage={setSelectedStageId}
          selectedStageId={selectedStageId}
        />
      </div>

      {/* Top Header UI */}
      <div className="relative z-10 pt-16 px-6 pointer-events-none">
        <div className="flex items-center mb-6 pointer-events-auto">
          <button 
            onClick={() => setCurrentTab('HOME')}
            className="flex items-center gap-3 text-white transition-colors text-sm font-bold tracking-widest bg-black/90 border-2 border-[#333] px-6 py-3 rounded-xl backdrop-blur-md"
          >
            <Home size={18} />
            <span>司令室へ戻る</span>
          </button>
        </div>

        <div className="flex justify-between items-start border-2 border-[#333] bg-black/90 p-6 rounded-2xl backdrop-blur-xl pointer-events-auto">
          <div className="space-y-4">
            <h2 className="text-base font-black text-white tracking-widest uppercase">
              Abyssal Sector 04
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-sm font-black text-secondary tracking-widest uppercase">
                SYNC: 94%
              </div>
              <div className="h-3 w-32 bg-[#222] rounded-full overflow-hidden border border-[#444]">
                <div className="h-full bg-secondary" style={{ width: '94%' }} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#222]">
              <span className="text-xs font-bold text-gray-400 tracking-widest">所持金</span>
              <span className="text-sm font-bold text-[#FCD34D] tracking-widest">4,200 G</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#222]">
              <span className="text-xs font-bold text-gray-400 tracking-widest">竜銀</span>
              <span className="text-sm font-bold text-primary tracking-widest">12</span>
            </div>
          </div>
        </div>
      </div>

      {/* Central Popup Panel */}
      <div 
        className={`z-[100] bg-black/80 backdrop-blur-md transition-opacity duration-300 ${selectedStage ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
        onPointerDown={() => setSelectedStageId(null)}
      >
        <AnimatePresence>
          {selectedStage && (
            <motion.div 
              key="modal-content"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-[92vw] max-w-[420px] bg-[#111] border-[2px] border-[#444] shadow-[0_10px_40px_rgba(0,0,0,0.8)] pointer-events-auto rounded-3xl overflow-hidden flex flex-col max-h-[85vh] m-auto"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col p-6 sm:p-8 w-full h-full overflow-y-auto custom-scrollbar">
                {/* INTEL VIEW */}
                {viewMode === 'INTEL' && (
                <div className="flex flex-col h-full relative z-10 w-full animate-fade-in text-gray-200">
                  <div className="flex items-center justify-between w-full mb-6 pb-4 border-b-[2px] border-[#333] shrink-0">
                    <div 
                      role="button"
                      onClick={() => setViewMode('SORTIE')} 
                      className="flex items-center gap-2 bg-[#222] px-5 py-3 rounded-xl border-2 border-[#444] cursor-pointer hover:bg-[#333] transition-colors"
                    >
                      <ChevronLeft size={18} className="text-gray-300" />
                      <span className="text-gray-300 text-sm font-black tracking-widest">戻る</span>
                    </div>
                    <span className="text-white font-black text-lg tracking-widest">攻略記録</span>
                    <div 
                      role="button"
                      onClick={() => setSelectedStageId(null)} 
                      className="bg-[#222] p-3 rounded-xl border-2 border-[#444] cursor-pointer hover:bg-[#333] transition-colors"
                    >
                      <X size={20} strokeWidth={3} className="text-gray-400" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar h-full">
                    
                    {/* Bestiary */}
                    <div className="flex flex-col gap-4 mt-2">
                      <div className="text-sm font-black text-gray-400 tracking-widest border-l-[4px] border-[#555] pl-3">出現魔物</div>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { icon: '💀', name: 'ゴブリン' },
                          { icon: '👻', name: '幽霊' },
                          { icon: '🧟', name: 'ゾンビ' },
                          { icon: '🦇', name: 'コウモリ' },
                        ].map((mob, i) => (
                          <div key={i} className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#222] border-[2px] border-[#333] rounded-2xl flex items-center justify-center text-3xl">
                              {mob.icon}
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-gray-300 w-full text-center">{mob.name}</span>
                          </div>
                        ))}
                      </div>

                      <div className="bg-[#1A1A1A] border-[2px] border-[#333] p-6 rounded-2xl flex flex-col gap-5 shadow-lg">
                        <div className="text-sm font-bold text-gray-500 tracking-widest uppercase">敵の傾向</div>
                        <div className="flex flex-col gap-4 text-sm font-bold">
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500 w-12 shrink-0">種族</span>
                            <div className="flex flex-wrap gap-3">
                              <span className="text-white bg-[#333] px-3 py-1 rounded-lg">亜人</span>
                              <span className="text-white bg-[#333] px-3 py-1 rounded-lg">不死</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500 w-12 shrink-0">弱点</span>
                            <div className="flex flex-wrap gap-3">
                              <span className="text-red-400 bg-[#3A1010] border border-red-900 px-3 py-1 rounded-lg">火</span>
                              <span className="text-yellow-400 bg-[#3A2D00] border border-yellow-900 px-3 py-1 rounded-lg">聖</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500 w-12 shrink-0">耐性</span>
                            <div className="flex flex-wrap gap-3">
                              <span className="text-purple-400 bg-[#2D103A] border border-purple-900 px-3 py-1 rounded-lg">闇</span>
                              <span className="text-green-400 bg-[#103A1C] border border-green-900 px-3 py-1 rounded-lg">毒</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Loot Table */}
                    <div className="flex flex-col gap-4 mt-4">
                      <div className="text-base font-black text-gray-400 tracking-widest border-l-[4px] border-[#555] pl-4">獲得可能品</div>
                      <div className="flex flex-col gap-3 text-sm font-bold">
                        {[
                          { lbl: 'Common', item: '🗡️ 錆びたショートソード', col: 'text-gray-400', border: 'border-[#333]' },
                          { lbl: 'Rare', item: '🛡️ 亡者の革鎧', col: 'text-blue-400', border: 'border-blue-900/50' },
                          { lbl: 'Super', item: '💎 霊核の欠片', col: 'text-yellow-400', border: 'border-yellow-900/50' }
                        ].map((loot, i) => (
                          <div key={i} className={`flex items-center gap-6 bg-[#1A1A1A] p-5 rounded-xl border-[2px] ${loot.border}`}>
                            <span className={`w-20 text-center font-black ${loot.col}`}>{loot.lbl}</span>
                            <span className="text-gray-200 text-base">{loot.item}</span>
                          </div>
                        ))}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-6 bg-[#250535] p-5 rounded-xl border-[2px] border-primary">
                          <span className="w-full sm:w-20 text-center font-black text-primary text-base">Unique</span>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <span className="text-white text-base tracking-widest">🔮 ？？？？？</span>
                            <span className="text-primary text-xs">(0.01%の未発見枠)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lore */}
                    <div className="flex flex-col gap-4 mt-4 mb-4">
                      <div className="text-base font-black text-gray-400 tracking-widest border-l-[4px] border-[#555] pl-4">エリア伝承</div>
                      <div className="text-sm text-gray-300 bg-[#1A1A1A] p-6 rounded-2xl border-[2px] border-[#333] leading-loose shadow-inner">
                        かつてこの地は、平和な辺境の村であった。<br/>
                        勇者の通過と共に焼き払われ、今はただ最弱種たちの<br/>
                        怨念が霧となって漂う死の地と化している。
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* SORTIE VIEW */}
              {viewMode === 'SORTIE' && (
                <div className="flex flex-col relative z-10 h-full w-full">
                  <div className="flex items-center justify-between pb-6 border-b-[2px] border-[#333] shrink-0">
                    <div className="flex items-center gap-4 w-full">
                      <div className={`w-16 h-16 rounded-2xl border-[3px] flex items-center justify-center shrink-0 
                        ${selectedStage.isAreaBoss ? 'bg-[#3A1010] border-tertiary text-tertiary' : 'bg-[#2D103A] border-primary text-primary'}`}>
                        {selectedStage.isAreaBoss ? <Skull size={32} /> : <MapIcon size={32} />}
                      </div>
                      <div className="flex flex-col gap-2 overflow-hidden">
                        <span className="text-sm font-bold text-gray-400 tracking-widest">エリア {selectedStage.id}</span>
                        <span className="text-2xl font-black text-white tracking-widest truncate leading-tight">
                          {selectedStage.name}
                        </span>
                      </div>
                    </div>
                    <div 
                      role="button"
                      onClick={() => setSelectedStageId(null)}
                      className="flex items-center justify-center text-[#888] hover:text-white bg-[#222] w-14 h-14 rounded-2xl border-2 border-[#444] ml-4 shrink-0 cursor-pointer"
                    >
                      <X size={26} strokeWidth={3} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-6 mt-6">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-black text-gray-300 tracking-[0.2em] border-l-[4px] border-[#BC00FB] pl-3 h-6 flex items-center">
                        編成中の軍団
                      </span>
                      <div 
                        role="button"
                        onClick={() => setViewMode('INTEL')}
                        className="flex items-center gap-2 text-secondary bg-[#102A2A] border-[2px] border-secondary/50 px-5 py-3 rounded-xl hover:bg-[#1A3A3A] transition-colors cursor-pointer"
                      >
                        <span className="text-[13px] font-black tracking-widest leading-none pt-0.5">攻略情報</span>
                        <Search size={16} strokeWidth={3} className="text-secondary" />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {party.map((member, idx) => (
                        <div key={idx} className="bg-[#1A1A1A] border-[2px] border-[#333] p-2 sm:p-3 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-lg aspect-square relative hover:bg-[#222] transition-colors">
                          <span className="text-[9px] sm:text-[10px] font-black text-gray-500 absolute top-2 left-2 sm:left-3 tracking-widest">UNIT {idx + 1}</span>
                          
                          {member ? (
                            <>
                              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#222] rounded-full border-2 border-[#444] flex items-center justify-center mt-3">
                                <span className="text-xl sm:text-2xl">🧟</span>
                              </div>
                              <div className="flex flex-col items-center justify-center w-full mt-auto pb-1">
                                <span className="text-[11px] sm:text-xs font-black text-white text-center truncate w-full tracking-wider">{member.name}</span>
                                <div className="flex items-center justify-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-400 bg-[#222] px-2 py-0.5 mt-1 rounded border border-[#444] w-full max-w-[80%]">
                                  <span>COST</span><span className="text-[#FCD34D] text-[10px] sm:text-xs">{member.cost}</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-40 gap-1.5 mt-2">
                              <span className="text-2xl sm:text-3xl text-gray-500">➕</span>
                              <span className="text-[9px] sm:text-[10px] font-bold tracking-widest text-gray-500">未配置</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-4 bg-[#1A1A1A] p-6 rounded-2xl border-2 border-[#333] mt-2 shadow-lg">
                      <div className="flex justify-between items-center w-full">
                        <span className="text-base font-black text-gray-300 tracking-widest">軍団コスト</span>
                        <span className="text-xl font-black text-white whitespace-nowrap font-sans">
                          {currentCost} <span className="text-gray-500 text-base">/ {maxCost}</span>
                        </span>
                      </div>
                      
                      <div className="w-full h-4 bg-[#222] rounded-full border border-[#444] overflow-hidden flex">
                        <div 
                          className="h-full bg-primary transition-all duration-300 rounded-full" 
                          style={{ width: `${Math.min(100, (currentCost / maxCost) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-between items-center gap-4 mt-8 pt-2">
                    <div 
                      role="button"
                      onClick={() => setSelectedStageId(null)}
                      className="flex-1 bg-[#222] border-[2px] border-[#444] h-[64px] rounded-2xl flex items-center justify-center cursor-pointer shadow-md hover:bg-[#333] transition-all"
                    >
                      <span className="text-white text-[16px] font-black tracking-[0.3em]">撤 退</span>
                    </div>
                    <div 
                      role="button"
                      onClick={() => onStartStage(selectedStage.id)}
                      className="flex-[2] bg-[#BC00FB] border-[2px] border-[#ff88ff]/20 h-[64px] rounded-2xl flex items-center justify-center gap-3 cursor-pointer shadow-[0_4px_20px_rgba(188,0,251,0.4)] hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span className="text-white text-[20px] font-black tracking-[0.2em] ml-2">蹂躙を開始する</span>
                      <ChevronRight size={26} className="text-white opacity-90" />
                    </div>
                  </div>
                </div>
              )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}