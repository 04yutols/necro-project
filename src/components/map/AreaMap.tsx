'use client';

import { useState } from 'react';
import { useGameStore } from '../../store/useGameStore';
import { Map as MapIcon, Skull, ShieldAlert, CheckCircle2 } from 'lucide-react';
import stagesData from '../../data/master/stages.json';
import { motion } from 'framer-motion';
import { FuchsiaButton } from '../ui/FuchsiaButton';

interface AreaMapProps {
  onStartStage: (stageId: string) => void;
}

export default function AreaMap({ onStartStage }: AreaMapProps) {
  const { player } = useGameStore();

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
      <div className="flex-1 w-full relative overflow-hidden bg-black/40 rounded-3xl border border-white/5 shadow-inner min-h-[500px]">
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
        <div className="absolute inset-0 z-10">
          {area1Stages.map((stage, index) => {
            const unlocked = isUnlocked(stage.id);
            const cleared = player.clearedStages.includes(stage.id);
            const isBoss = (stage as any).isAreaBoss;
            const pos = positions[index] || { x: `${(index + 1) * 20}%`, y: '50%' };
            
            return (
              <div 
                key={stage.id} 
                className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ left: pos.x, top: pos.y }}
              >
                {/* Node Button - Direct Trigger */}
                <button 
                  onClick={() => {
                    console.log("MAP NODE CLICKED:", stage.id);
                    if (unlocked) {
                      onStartStage(stage.id);
                    } else {
                      console.warn("Node is locked!");
                    }
                  }}
                  disabled={!unlocked}
                  className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all duration-300 relative shadow-2xl hover:scale-110 active:scale-95
                    ${unlocked 
                      ? cleared
                        ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_20px_rgba(0,255,255,0.4)]'
                        : isBoss
                          ? 'bg-fuchsia/20 border-fuchsia text-fuchsia shadow-[0_0_20px_rgba(255,0,255,0.4)]'
                          : 'bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(188,0,251,0.4)]'
                      : 'bg-gray-900 border-gray-800 text-gray-700 opacity-50'
                    }
                  `}
                >
                  {cleared ? <CheckCircle2 size={28} /> : isBoss ? <Skull size={28} /> : <MapIcon size={28} />}
                  
                  {unlocked && !cleared && (
                    <div className="absolute -inset-1 border border-inherit rounded-2xl animate-pulse opacity-50" />
                  )}
                </button>
                
                <div className="text-center mt-3 pointer-events-none">
                  <div className={`text-[10px] font-black tracking-[0.2em] uppercase mb-0.5 ${unlocked ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stage.id}
                  </div>
                  <div className={`text-[12px] font-black tracking-widest whitespace-nowrap drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] ${unlocked ? 'text-white' : 'text-gray-700'}`}>
                    {unlocked ? stage.name : 'ENCRYPTED'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
