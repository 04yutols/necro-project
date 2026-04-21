import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GameFrameProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  title?: React.ReactNode;
  borderColor?: 'fuchsia' | 'necro' | 'primary' | 'secondary' | 'gray';
}

export function GameFrame({ 
  children, 
  className, 
  title, 
  borderColor = 'fuchsia', 
  ...props 
}: GameFrameProps) {
  const borderStyles = {
    fuchsia: 'pixel-border-fuchsia',
    necro: 'pixel-border-primary border-purple-600',
    primary: 'pixel-border-primary',
    secondary: 'pixel-border-secondary',
    gray: 'border border-gray-800 rounded-2xl'
  };

  const bgStyles = "bg-black/60 backdrop-blur-md relative overflow-hidden rounded-2xl";

  return (
    <div 
      className={cn(
        bgStyles,
        borderStyles[borderColor as keyof typeof borderStyles],
        className
      )}
      {...props}
    >
      {/* Dithering / Dot pattern background */}
      <div className="absolute inset-0 bg-dot-pattern opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-20 pointer-events-none" />
      
      {title && (
        <div className="border-b border-white/10 px-6 py-3 bg-black/40 relative z-20">
          <h2 className="text-lg font-cinzel font-bold tracking-[0.3em] text-white drop-shadow-[0_0_10px_rgba(188,0,251,0.5)]">
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
