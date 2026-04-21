'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export function MobileHeader() {
  const { player } = useGameStore();

  return (
    <header className="fixed top-0 w-full h-16 border-b border-[#BF00FF]/15 bg-[#0B0E14]/80 backdrop-blur-xl flex justify-between items-center px-6 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-secondary shadow-[0_0_10px_rgba(0,255,171,0.5)] overflow-hidden bg-black/40">
          <img 
            alt="Player Avatar"
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aldo&backgroundColor=0b0e14"
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-lg font-black text-primary drop-shadow-[0_0_8px_rgba(191,0,255,0.6)] font-headline tracking-wider uppercase">
          {player?.name || 'NECROMANCER'}
        </h1>
      </div>
      <button className="text-white/60 hover:text-primary transition-colors">
        <Settings size={24} />
      </button>
    </header>
  );
}
