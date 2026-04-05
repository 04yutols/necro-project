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
      {/* Thin Neon Header */}
      <header className="w-full h-12 bg-black/90 border-b border-secondary/50 shadow-[0_2px_15px_rgba(0,255,171,0.2)] flex items-center px-6 relative z-50">
        <div className="absolute inset-0 bg-dither-pattern opacity-10 pointer-events-none" />
        <h1 className="text-xl font-bold font-cinzel text-secondary tracking-widest drop-shadow-[0_0_8px_rgba(0,255,171,0.8)] flex items-center gap-3">
          <Activity size={18} className="animate-pulse" />
          NECRO-DASHBOARD <span className="text-[10px] font-space tracking-tight text-primary/80 opacity-70">v1.0.0</span>
        </h1>
      </header>

      {/* Main 3-Column Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Background with pixel grid */}
        <div className="absolute inset-0 bg-dark pixel-grid opacity-30 pointer-events-none z-0" />
        
        {/* 20% Left Sidebar (Status & Avatar) */}
        <div className="relative z-10 w-[20%] h-full border-r-2 border-primary/30 bg-black/40 backdrop-blur-md shadow-[5px_0_20px_rgba(224,141,255,0.05)] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          {leftSidebar}
        </div>

        {/* 60% Main Monitor */}
        <div className="relative z-10 w-[60%] h-full flex flex-col p-4 bg-gradient-to-b from-transparent to-[#1a0a2a]/30 overflow-hidden">
          <div className="flex-1 w-full h-full border-2 border-secondary/60 rounded-xl shadow-[0_0_30px_rgba(0,255,171,0.15)] bg-black/90 overflow-hidden relative flex flex-col hologram-scan">
            {/* Aspect Ratio 16:9 Inner Container Container */}
            <div className="flex-1 w-full flex flex-col relative z-20">
              {mainMonitor}
            </div>
          </div>
        </div>

        {/* 20% Right Sidebar (Log & Party) */}
        <div className="relative z-10 w-[20%] h-full border-l-2 border-primary/30 bg-black/40 backdrop-blur-md shadow-[-5px_0_20px_rgba(224,141,255,0.05)] p-4 flex flex-col gap-4 overflow-hidden">
          {rightSidebar}
        </div>
      </div>
    </div>
  );
}
