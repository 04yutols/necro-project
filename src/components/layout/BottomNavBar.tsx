'use client';

import React from 'react';
import { Home, Map, Sword, Skull, Terminal, Swords } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';

const TABS = [
  { id: 'HOME', label: 'HOME', icon: Home },
  { id: 'MAP', label: 'MAP', icon: Map },
  { id: 'BATTLE', label: 'BATTLE', icon: Swords },
  { id: 'EQUIP', label: 'LEGION', icon: Sword },
  { id: 'LAB', label: 'LAB', icon: Skull },
  { id: 'LOGS', label: 'LOGS', icon: Terminal },
] as const;

export function BottomNavBar() {
  const { currentTab, setCurrentTab } = useGameStore();

  return (
    <nav className="fixed bottom-0 w-full h-14 bg-[#0D0D0D] border-t border-[#2C2C2C] flex justify-around items-center px-1 z-50">
      {TABS.map((tab) => {
        const isActive = currentTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id as any)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors relative
              ${isActive ? 'bg-[#1A1A1A] text-secondary' : 'text-gray-600 hover:text-gray-400'}
            `}
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
    </nav>
  );
}
