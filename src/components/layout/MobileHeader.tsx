'use client';

import React from 'react';
import { Settings, Home } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

export function MobileHeader() {
  const { player, currentTab, setCurrentTab } = useGameStore();

  return (
    <header className="fixed top-0 w-full h-10 border-b border-[#2C2C2C] bg-[#0D0D0D] flex justify-between items-center px-4 z-50">
      <div className="flex items-center gap-3">
        {currentTab !== 'HOME' && (
          <button 
            onClick={() => setCurrentTab('HOME')}
            className="text-gray-400 hover:text-primary transition-colors flex items-center justify-center p-1 rounded-sm border border-[#1A1A1A] bg-[#050505]"
            title="Return to Home"
          >
            <Home size={14} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-secondary tracking-widest uppercase">
            {player?.name || 'NECROMANCER'}
          </span>
          <span className="text-[8px] text-gray-600 border border-[#1A1A1A] px-1 rounded uppercase">
            LV.99
          </span>
        </div>
      </div>
      <button className="text-gray-600 hover:text-secondary transition-colors">
        <Settings size={14} />
      </button>
    </header>
  );
}
