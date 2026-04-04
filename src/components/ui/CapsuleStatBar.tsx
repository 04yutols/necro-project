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
    primary: 'bg-primary shadow-[0_0_10px_rgba(224,141,255,0.8)]',
    secondary: 'bg-secondary shadow-[0_0_10px_rgba(0,255,171,0.8)]',
    blood: 'bg-blood shadow-[0_0_10px_rgba(136,8,8,0.8)]'
  };

  return (
    <div className="w-full flex flex-col gap-1 my-2">
      <div className="flex justify-between items-end font-bold text-[10px] uppercase tracking-widest text-gray-400">
        <span>{label}</span>
        <span className="text-white">{value} / {max}</span>
      </div>
      <div className="relative w-full h-5 bg-black/80 rounded-capsule border border-gray-700 overflow-hidden shadow-inner flex items-center p-0.5">
        <motion.div 
          className={`h-full rounded-capsule relative ${bgColors[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          {/* Liquid highlight */}
          <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/30 rounded-t-capsule" />
        </motion.div>
      </div>
    </div>
  );
}
