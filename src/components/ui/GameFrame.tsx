import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GameFrameProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
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
  const borderStyles = {
    blood: 'pixel-border-blood',
    necro: 'pixel-border-primary border-purple-600',
    gray: 'border-4 border-gray-800 rounded-2xl'
  };

  const bgStyles = "bg-dark/95 backdrop-blur-xl relative overflow-hidden";

  return (
    <div 
      className={cn(
        bgStyles,
        borderStyles[borderColor],
        className
      )}
      {...props}
    >
      {/* Dithering / Dot pattern background */}
      <div className="absolute inset-0 bg-dot-pattern opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-30 pointer-events-none" />
      
      {title && (
        <div className="border-b-4 border-white/5 px-6 py-4 bg-black/40 relative z-20">
          <h2 className="text-xl font-cinzel font-bold tracking-[0.2em] text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
            {title}
          </h2>
        </div>
      )}
      <div className="relative z-10 p-6">
        {children}
      </div>
    </div>
  );
}
