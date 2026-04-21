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
    fuchsia: 'border-fuchsia/30 hover:border-fuchsia/50',
    necro: 'border-necro/30 hover:border-necro/50',
    primary: 'border-primary/30 hover:border-primary/50',
    secondary: 'border-secondary/30 hover:border-secondary/50',
    gray: 'border-white/5 hover:border-white/10'
  };

  const bgStyles = "bg-surface/80 backdrop-blur-xl relative overflow-hidden rounded-lg lg:rounded-2xl border transition-colors duration-500";

  return (
    <div 
      className={cn(
        bgStyles,
        borderStyles[borderColor as keyof typeof borderStyles],
        className
      )}
      {...props}
    >
      {/* Visual Overlays */}
      <div className="absolute inset-0 dot-pattern opacity-10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-10 pointer-events-none" />
      
      {title && (
        <div className="border-b border-white/5 px-4 py-2 lg:px-6 lg:py-3 bg-black/20 relative z-20">
          <h2 className="text-xs lg:text-lg font-headline font-black tracking-widest text-primary drop-shadow-[0_0_8px_rgba(191,0,255,0.4)] uppercase">
            {title}
          </h2>
        </div>
      )}
      <div className="relative z-10 p-4 lg:p-8">
        {children}
      </div>
    </div>
  );
}
