'use client';

import React from 'react';
import { MobileHeader } from './MobileHeader';
import { BottomNavBar } from './BottomNavBar';

interface ResponsiveFrameProps {
  leftSidebar: React.ReactNode;
  mainMonitor: React.ReactNode;
  rightSidebar: React.ReactNode;
}

export function ResponsiveFrame({ leftSidebar, mainMonitor, rightSidebar }: ResponsiveFrameProps) {
  return (
    <div className="w-full h-screen bg-[#050505] text-[#A5A9B4] font-body overflow-hidden flex flex-col relative selection:bg-secondary/30">
      <div className="fixed inset-0 pixel-grid opacity-20 pointer-events-none z-0" />
      
      <MobileHeader />

      <main className="flex-1 mt-10 mb-14 p-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar relative z-10">
        <div className="flex flex-col gap-1 h-full">
          {mainMonitor}
        </div>
      </main>

      <div className="z-50">
        <BottomNavBar />
      </div>
    </div>
  );
}
