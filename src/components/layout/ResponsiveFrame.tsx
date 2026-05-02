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
    <div className="w-full h-[100dvh] bg-[#050505] text-[#A5A9B4] font-body overflow-hidden relative selection:bg-secondary/30">
      <div className="fixed inset-0 pixel-grid opacity-20 pointer-events-none z-0" />

      <MobileHeader />

      {/* absolute配置で高さを明示的に確定させる — flex-1+h-fullの連鎖を避ける */}
      <main style={{
        position: 'absolute',
        top: '40px',
        bottom: '56px',
        left: 0,
        right: 0,
        overflow: 'hidden',
        zIndex: 10,
      }}>
        {mainMonitor}
      </main>

      <BottomNavBar />
    </div>
  );
}
