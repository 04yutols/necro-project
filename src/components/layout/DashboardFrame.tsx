import React from 'react';
import { Activity } from 'lucide-react';

interface DashboardFrameProps {
  leftSidebar: React.ReactNode;
  mainMonitor: React.ReactNode;
  rightSidebar: React.ReactNode;
}

export function DashboardFrame({ leftSidebar, mainMonitor, rightSidebar }: DashboardFrameProps) {
  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex flex-col bg-dark text-white font-space selection:bg-primary/50">
      {/* Refined Header - Simple Title Logo */}
      <header className="w-full h-14 bg-black/95 border-b-4 border-white/5 flex items-center justify-center relative z-50">
        <div className="absolute inset-0 bg-dither-pattern opacity-10 pointer-events-none" />
        <h1 className="text-2xl font-bold font-cinzel text-white tracking-[0.4em] drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#BC00FB]" />
          NECRO-POP <span className="text-secondary opacity-80">OS</span>
          <div className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_#00FFFF]" />
        </h1>
      </header>

      {/* Main 3-Column Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Background with dot grid */}
        <div className="absolute inset-0 bg-dark dot-pattern opacity-40 pointer-events-none z-0" />
        
        {/* 22% Left Sidebar (Status & Avatar) */}
        <div className="relative z-10 w-[22%] h-full border-r border-white/10 bg-black/60 backdrop-blur-xl p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          <div className="absolute inset-0 honeycomb-grid opacity-10 pointer-events-none" />
          <div className="relative z-20 h-full flex flex-col gap-6">
            {leftSidebar}
          </div>
        </div>

        {/* 56% Main Monitor */}
        <div className="relative z-10 w-[56%] h-full flex flex-col p-6 overflow-hidden">
          <div className="flex-1 w-full h-full border border-white/10 rounded-3xl bg-black/80 overflow-hidden relative flex flex-col hologram-scan shadow-2xl">
            {/* Subtle Neon Glow Around Monitor */}
            <div className="absolute -inset-1 bg-primary/10 blur-xl pointer-events-none" />
            
            {/* Aspect Ratio 16:9 Inner Container */}
            <div className="flex-1 w-full flex flex-col relative z-20">
              {mainMonitor}
            </div>
          </div>
        </div>

        {/* 22% Right Sidebar (Log & Party) */}
        <div className="relative z-10 w-[22%] h-full border-l border-white/10 bg-black/60 backdrop-blur-xl p-6 flex flex-col gap-6 overflow-hidden">
          <div className="absolute inset-0 honeycomb-grid opacity-10 pointer-events-none" />
          <div className="relative z-20 h-full flex flex-col gap-6">
            {rightSidebar}
          </div>
        </div>
      </div>
    </div>
  );
}
