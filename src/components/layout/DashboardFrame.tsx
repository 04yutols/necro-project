import React from 'react';
import { Activity, Bell, LayoutGrid } from 'lucide-react';

interface DashboardFrameProps {
  leftSidebar: React.ReactNode;
  mainMonitor: React.ReactNode;
  rightSidebar: React.ReactNode;
}

export function DashboardFrame({ leftSidebar, mainMonitor, rightSidebar }: DashboardFrameProps) {
  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-col bg-[#050505] text-white font-space selection:bg-primary/50 relative">
      {/* Background Pixel Grid - Horizontal Lines Style */}
      <div className="absolute inset-0 pixel-grid opacity-20 pointer-events-none z-0" />

      {/* Refined Header - Left Logo, Right Nav */}
      <header className="w-full h-16 bg-black/40 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-8 relative z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold font-cinzel text-primary tracking-[0.2em] drop-shadow-[0_0_10px_rgba(188,0,251,0.5)]">
            NECROMANCE <span className="text-white">BRAVE</span>
          </h1>
        </div>

        <div className="flex items-center gap-8">
          <nav className="flex items-center gap-6">
            {['MAP', 'ARMY', 'GRIMOIRE'].map((item) => (
              <button 
                key={item} 
                className={`text-xs font-bold tracking-[0.2em] transition-colors hover:text-primary ${item === 'MAP' ? 'text-primary' : 'text-gray-400'}`}
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4 border-l border-white/10 pl-8 ml-4">
            <LayoutGrid size={18} className="text-gray-400 cursor-pointer hover:text-primary transition-colors" />
            <div className="relative">
              <Bell size={18} className="text-gray-400 cursor-pointer hover:text-primary transition-colors" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-fuchsia rounded-full shadow-[0_0_5px_#FF00FF]" />
            </div>
          </div>
        </div>
      </header>

      {/* Main 3-Column Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* 22% Left Sidebar (Status & Avatar) */}
        <div className="relative w-[22%] h-full border-r border-white/5 bg-black/20 backdrop-blur-xl p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="absolute inset-0 honeycomb-grid opacity-5 pointer-events-none" />
          <div className="relative z-20 h-full flex flex-col">
            {leftSidebar}
          </div>
        </div>

        {/* 56% Main Monitor */}
        <div className="relative w-[56%] h-full flex flex-col p-8 overflow-hidden bg-gradient-to-b from-transparent to-primary/5">
          {mainMonitor}
        </div>

        {/* 22% Right Sidebar (Log & Party) */}
        <div className="relative w-[22%] h-full border-l border-white/5 bg-black/20 backdrop-blur-xl p-6 flex flex-col gap-6 overflow-hidden">
          <div className="absolute inset-0 honeycomb-grid opacity-5 pointer-events-none" />
          <div className="relative z-20 h-full flex flex-col">
            {rightSidebar}
          </div>
        </div>
      </div>
    </div>
  );
}
