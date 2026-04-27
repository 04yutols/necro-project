import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GameFrameProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  title?: React.ReactNode;
  borderColor?: 'iron' | 'gold' | 'blood' | 'gray';
}

export function GameFrame({ 
  children, 
  className, 
  title, 
  borderColor = 'iron', 
  ...props 
}: GameFrameProps) {
  const borderStyles = {
    iron: 'border-[#2C2C2C]',
    gold: 'border-[#8A6D1F]',
    blood: 'border-[#4A0000]',
    gray: 'border-[#1A1A1A]'
  };

  return (
    <div 
      className={cn(
        "bg-[#0D0D0D] border relative overflow-hidden",
        borderStyles[borderColor as keyof typeof borderStyles],
        className
      )}
      {...props}
    >
      {title && (
        <div className="border-b border-inherit px-3 py-1.5 bg-[#151515] relative z-20">
          <h2 className="text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
            {title}
          </h2>
        </div>
      )}
      <div className="relative z-10 p-2 lg:p-4">
        {children}
      </div>
    </div>
  );
}
