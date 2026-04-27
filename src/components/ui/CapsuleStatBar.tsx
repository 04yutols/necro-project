'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface CapsuleStatBarProps {
  label: string;
  value: number;
  max: number;
  type: 'hp' | 'mp' | 'exp' | 'cost';
}

const STAT_CONFIG = {
  hp: { color: '#8B0000', label: 'HP' },
  mp: { color: '#2B4A78', label: 'MP' },
  exp: { color: '#D4AF37', label: 'EXP' },
  cost: { color: '#4A4D55', label: 'COST' },
};

export function CapsuleStatBar({ label, value, max, type }: CapsuleStatBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const config = STAT_CONFIG[type];

  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="flex justify-between items-baseline px-0.5">
        <span className="text-[9px] font-bold text-primary tracking-tighter">{config.label}</span>
        <span className="text-[8px] font-mono text-gray-500">{value}/{max}</span>
      </div>
      <div className="h-1 w-full bg-[#1A1A1A] overflow-hidden">
        <motion.div
          className="h-full"
          style={{ backgroundColor: config.color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 30 }}
        />
      </div>
    </div>
  );
}
