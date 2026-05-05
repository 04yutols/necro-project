'use client';

import React from 'react';

interface ResponsiveFrameProps {
  leftSidebar: React.ReactNode;
  mainMonitor: React.ReactNode;
  rightSidebar: React.ReactNode;
}

export function ResponsiveFrame({ leftSidebar, mainMonitor, rightSidebar }: ResponsiveFrameProps) {
  return (
    <div
      className="ios-app-shell text-[#A5A9B4] font-body selection:bg-secondary/30"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#050505',
      }}
    >
      <div className="absolute inset-0 pixel-grid opacity-20 pointer-events-none z-0" />

      <main style={{
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        {mainMonitor}
      </main>
    </div>
  );
}
