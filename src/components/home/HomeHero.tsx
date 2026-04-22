'use client';

import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { CapsuleStatBar } from '../ui/CapsuleStatBar';
import { motion } from 'framer-motion';
import { Map, Skull, Sword, Terminal, ChevronRight } from 'lucide-react';

export function HomeHero() {
  const { player, setCurrentTab } = useGameStore();

  if (!player) return null;

  const NAV_BUTTONS = [
    { id: 'MAP', label: 'DEPLOY TO MAP', icon: Map, color: 'text-primary', border: 'border-primary/30', bg: 'bg-primary/10' },
    { id: 'LAB', label: 'NECRO LAB', icon: Skull, color: 'text-tertiary', border: 'border-tertiary/30', bg: 'bg-tertiary/10' },
    { id: 'EQUIP', label: 'ARMORY', icon: Sword, color: 'text-secondary', border: 'border-secondary/30', bg: 'bg-secondary/10' },
    { id: 'LOGS', label: 'SYSTEM LOGS', icon: Terminal, color: 'text-gray-400', border: 'border-gray-700', bg: 'bg-gray-900/50' },
  ] as const;

  return (
    <div className="w-full h-full flex flex-col bg-[#050505] overflow-y-auto custom-scrollbar pb-6 px-4 pt-4">
      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 relative rounded-2xl overflow-hidden border border-[#2C2C2C] bg-[#0D0D0D] shadow-lg"
      >
        {/* Abstract Background for Avatar area */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-primary blur-[80px] rounded-full" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-secondary blur-[80px] rounded-full" />
        </div>

        <div className="p-5 relative z-10 flex items-center gap-4">
          <div className="w-20 h-20 bg-black border-2 border-[#1A1A1A] rounded-xl flex items-center justify-center overflow-hidden shrink-0 relative">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Necro&backgroundColor=050505&mood[]=sad" 
              alt="Avatar"
              className="w-[120%] h-auto grayscale contrast-125 translate-y-2"
            />
            <div className="absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-black to-transparent" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-1.5 py-0.5 bg-[#1A1A1A] text-gray-300 text-[10px] font-black rounded-sm tracking-wider">LV.99</span>
              <h2 className="text-base font-black text-white truncate uppercase tracking-widest">{player.name || 'NECROMANCER'}</h2>
            </div>
            <div className="text-xs font-bold text-primary tracking-widest uppercase mb-3 drop-shadow-[0_0_5px_rgba(188,0,251,0.5)]">
              {player.currentJobId}
            </div>
            
            <div className="space-y-2">
              <CapsuleStatBar label="HP" value={player.stats.hp} max={player.stats.maxHp} type="hp" />
              <CapsuleStatBar label="MP" value={player.stats.mp} max={player.stats.maxMp || 20} type="mp" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Primary Actions Grid */}
      <div className="flex-1 flex flex-col gap-3">
        <h3 className="text-xs font-black text-gray-500 tracking-[0.2em] uppercase px-1 mb-1">Command Hub</h3>
        
        {NAV_BUTTONS.map((btn, index) => {
          const Icon = btn.icon;
          return (
            <motion.button
              key={btn.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setCurrentTab(btn.id as any)}
              className={`w-full flex items-center justify-between p-4 rounded-xl border ${btn.border} ${btn.bg} backdrop-blur-sm transition-all hover:brightness-125 active:scale-[0.98]`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg bg-black/50 border border-white/5 flex items-center justify-center ${btn.color} shadow-inner`}>
                  <Icon size={24} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-black text-white tracking-widest uppercase drop-shadow-md">
                    {btn.label}
                  </span>
                  <span className={`text-[10px] font-bold ${btn.color} tracking-widest uppercase opacity-80`}>
                    Access System
                  </span>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-black/30 ${btn.color}`}>
                <ChevronRight size={20} />
              </div>
            </motion.button>
          );
        })}
      </div>
      
      {/* Footer Info */}
      <div className="mt-8 mb-4 flex justify-center">
        <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-[#1A1A1A] bg-black/40">
          <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#00FFFF]" />
          <span className="text-[9px] font-black text-gray-400 tracking-[0.3em] uppercase">SYSTEM ONLINE</span>
          <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#00FFFF]" />
        </div>
      </div>
    </div>
  );
}
