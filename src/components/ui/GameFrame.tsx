import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GameFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: React.ReactNode;
  borderColor?: 'blood' | 'necro' | 'gray';
}

export function GameFrame({ 
  children, 
  className, 
  title, 
  borderColor = 'blood', 
  ...props 
}: GameFrameProps) {
  const borderColors = {
    blood: 'border-blood',
    necro: 'border-necro',
    gray: 'border-gray-800'
  };

  const shadowColors = {
    blood: 'shadow-[0_0_15px_rgba(136,8,8,0.3)]',
    necro: 'shadow-[0_0_15px_rgba(168,85,247,0.2)]',
    gray: 'shadow-[0_0_10px_rgba(0,0,0,0.5)]'
  };

  return (
    <div 
      className={cn(
        "relative bg-dark/90 backdrop-blur-md rounded-lg border-2",
        borderColors[borderColor],
        shadowColors[borderColor],
        className
      )}
      {...props}
    >
      {/* 鉄のような質感を出すためのオーバーレイ（任意） */}
      <div className="absolute inset-0 pointer-events-none rounded-lg bg-gradient-to-b from-white/5 to-transparent opacity-50" />
      
      {title && (
        <div className="border-b border-white/10 px-4 py-3 bg-black/40 rounded-t-md">
          <h2 className="text-xl font-cinzel font-bold tracking-widest text-cursedGold drop-shadow-[0_0_5px_rgba(255,215,0,0.3)]">
            {title}
          </h2>
        </div>
      )}
      <div className="relative z-10 p-4">
        {children}
      </div>
    </div>
  );
}
