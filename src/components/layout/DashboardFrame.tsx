import React from 'react';

interface DashboardFrameProps {
  leftSidebar: React.ReactNode;
  mainMonitor: React.ReactNode;
  rightSidebar: React.ReactNode;
}

export function DashboardFrame({ leftSidebar, mainMonitor, rightSidebar }: DashboardFrameProps) {
  return (
    <div className="w-full h-screen max-h-screen overflow-hidden flex bg-dark text-white font-space selection:bg-primary/50">
      {/* Background with dithering */}
      <div className="absolute inset-0 bg-dither-pattern opacity-20 pointer-events-none mix-blend-overlay z-0" />
      
      {/* 20% Left Sidebar */}
      <div className="relative z-10 w-[20%] h-full border-r-2 border-primary/50 bg-dark/90 backdrop-blur-md shadow-[5px_0_20px_rgba(224,141,255,0.15)] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {leftSidebar}
      </div>

      {/* 60% Main Monitor */}
      <div className="relative z-10 w-[60%] h-full flex flex-col p-6 bg-gradient-to-b from-dark to-[#1a0a2a]">
        <div className="flex-1 w-full h-full border-2 border-secondary/60 rounded-xl shadow-[0_0_30px_rgba(0,255,171,0.15)] bg-black/80 overflow-hidden relative flex flex-col">
          {mainMonitor}
        </div>
      </div>

      {/* 20% Right Sidebar */}
      <div className="relative z-10 w-[20%] h-full border-l-2 border-primary/50 bg-dark/90 backdrop-blur-md shadow-[-5px_0_20px_rgba(224,141,255,0.15)] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {rightSidebar}
      </div>
    </div>
  );
}
