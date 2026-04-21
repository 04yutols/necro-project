'use client';

import React from 'react';
import { Swords, Ghost, BookOpen, Terminal } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'BATTLE', label: 'BATTLE', icon: Swords },
  { id: 'ARMY', label: 'ARMY', icon: Ghost },
  { id: 'GRIMOIRE', label: 'SKILLS', icon: BookOpen },
  { id: 'LOGS', label: 'LOGS', icon: Terminal },
] as const;

export function BottomNavBar() {
  const { currentTab, setCurrentTab } = useGameStore();

  return (
    <nav className="fixed bottom-0 w-full h-20 bg-[#0B0E14]/90 backdrop-blur-md rounded-t-[2rem] border-t border-[#00FFFF]/20 flex justify-around items-center px-4 z-50 shadow-[0_-10px_30px_rgba(0,255,171,0.1)]">
      {TABS.map((tab) => {
        const isActive = currentTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id as any)}
            className="relative flex flex-col items-center justify-center transition-all duration-300"
          >
            {isActive && (
              <motion.div
                layoutId="nav-glow"
                className="absolute inset-0 bg-[#00FFAB]/10 rounded-full px-8 py-4 -z-10 shadow-[0_0_15px_rgba(0,255,171,0.3)]"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <Icon 
              size={24} 
              className={`transition-colors duration-300 ${isActive ? 'text-secondary' : 'text-gray-500'}`} 
            />
            <span 
              className={`text-[10px] font-bold font-label mt-1 tracking-widest transition-colors duration-300 ${isActive ? 'text-secondary' : 'text-gray-500'}`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
