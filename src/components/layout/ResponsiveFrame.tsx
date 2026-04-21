'use client';

import React, { useState, useEffect } from 'react';
import { MobileHeader } from './MobileHeader';
import { BottomNavBar } from './BottomNavBar';
import { DashboardFrame } from './DashboardFrame';
import { useGameStore } from '../../store/useGameStore';

interface ResponsiveFrameProps {
  leftSidebar: React.ReactNode;
  mainMonitor: React.ReactNode;
  rightSidebar: React.ReactNode;
}

export function ResponsiveFrame({ leftSidebar, mainMonitor, rightSidebar }: ResponsiveFrameProps) {
  const [isMobile, setIsMobile] = useState(false);
  const { currentTab } = useGameStore();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div className="w-full h-screen bg-background text-on-surface font-body overflow-hidden flex flex-col selection:bg-primary/30">
        <MobileHeader />
        
        <main className="flex-1 mt-16 mb-20 p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar relative">
          {/* Background Dither/Grid */}
          <div className="fixed inset-0 dot-pattern opacity-10 pointer-events-none -z-10" />
          
          {/* Tab Content Switching */}
          {currentTab === 'BATTLE' && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-500">
              {mainMonitor}
            </div>
          )}
          
          {currentTab === 'ARMY' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
              {leftSidebar}
            </div>
          )}
          
          {currentTab === 'LOGS' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300">
              {rightSidebar}
            </div>
          )}

          {currentTab === 'GRIMOIRE' && (
            <div className="flex flex-col gap-4 items-center justify-center h-full opacity-40 font-headline italic">
              GRIMOIRE SYSTEM OFFLINE
            </div>
          )}
        </main>

        <BottomNavBar />
      </div>
    );
  }

  return (
    <DashboardFrame 
      leftSidebar={leftSidebar}
      mainMonitor={mainMonitor}
      rightSidebar={rightSidebar}
    />
  );
}
