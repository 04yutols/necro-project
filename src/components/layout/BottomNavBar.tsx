'use client';

import React from 'react';
import { Home, Map, Sword, Skull, Terminal, Swords, Lock } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { isAbyssalResidueUnlocked } from '../../logic/AbyssalResidueUnlockSystem';

const TABS = [
  { id: 'HOME', label: 'HOME', icon: Home },
  { id: 'MAP', label: 'MAP', icon: Map },
  { id: 'BATTLE', label: 'BATTLE', icon: Swords },
  { id: 'EQUIP', label: 'LEGION', icon: Sword },
  { id: 'LAB', label: 'LAB', icon: Skull },
  { id: 'LOGS', label: 'LOGS', icon: Terminal },
] as const;

export function BottomNavBar() {
  const { currentTab, setCurrentTab, player } = useGameStore();
  const residueUnlocked = isAbyssalResidueUnlocked(player?.clearedStages);

  return (
    <nav
      className="w-full shrink-0 bg-[#0D0D0D] border-t border-[#2C2C2C] z-50 relative"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="h-14 flex justify-around items-center px-1">
        {TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          const isLocked = tab.id === 'LAB' && !residueUnlocked;
          const Icon = isLocked ? Lock : tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (isLocked) return;
                setCurrentTab(tab.id as any);
              }}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative
                ${isActive ? 'bg-[#1A1A1A] text-secondary' : isLocked ? 'text-gray-700' : 'text-gray-600 hover:text-gray-400'}
              `}
              aria-disabled={isLocked}
            >
              {isActive && (
                <div className="absolute top-0 left-0 w-full h-[2px] bg-secondary" />
              )}
              <Icon size={16} />
              <span className="text-[7px] font-bold mt-1 tracking-wider uppercase font-mono">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
