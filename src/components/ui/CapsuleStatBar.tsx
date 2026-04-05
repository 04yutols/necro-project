import React from 'react';
import { motion } from 'framer-motion';

interface CapsuleStatBarProps {
  label: string;
  value: number;
  max: number;
  color: 'primary' | 'secondary' | 'blood';
}

export function CapsuleStatBar({ label, value, max, color }: CapsuleStatBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const bgColors = {
    primary: 'bg-primary shadow-[0_0_20px_rgba(224,141,255,0.6)]',
    secondary: 'bg-secondary shadow-[0_0_20px_rgba(0,255,171,0.6)]',
    blood: 'bg-blood shadow-[0_0_20px_rgba(255,46,46,0.6)]'
  };

  return (
    <div className="w-full flex flex-col gap-1.5 my-3">
      <div className="flex justify-between items-end font-bold text-[11px] uppercase tracking-[0.2em] text-gray-400 font-space">
        <span>{label}</span>
        <span className="text-white bg-black/40 px-2 py-0.5 rounded-full">{value} / {max}</span>
      </div>
      <div className="relative w-full h-7 bg-black/60 rounded-capsule border-2 border-white/10 overflow-hidden shadow-inner flex items-center p-1 backdrop-blur-sm">
        <motion.div 
          className={`h-full rounded-capsule relative ${bgColors[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          {/* Liquid highlight / Wave */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-t-capsule" />
          
          {/* Animated Wave Overlay */}
          <div className="absolute top-0 right-0 bottom-0 w-24 bg-white/10 animate-wave pointer-events-none blur-sm" style={{ transformOrigin: 'right center' }} />
        </motion.div>
      </div>
    </div>
  );
}
