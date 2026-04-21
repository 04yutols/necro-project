'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Zap, Shield, Sparkles } from 'lucide-react';

interface CapsuleStatBarProps {
  label: string;
  value: number;
  max: number;
  type: 'hp' | 'mp' | 'exp' | 'cost';
}

const STAT_CONFIG = {
  hp: { icon: Heart, color: 'text-tertiary', bg: 'bg-tertiary', glow: 'shadow-[0_0_10px_rgba(255,107,155,0.4)]', fill: 'liquid-fill-tertiary' },
  mp: { icon: Zap, color: 'text-primary', bg: 'bg-primary', glow: 'shadow-[0_0_10px_rgba(224,141,255,0.4)]', fill: 'bg-primary' },
  exp: { icon: Sparkles, color: 'text-secondary', bg: 'bg-secondary', glow: 'shadow-[0_0_10px_rgba(0,255,171,0.4)]', fill: 'liquid-fill' },
  cost: { icon: Shield, color: 'text-cursedGold', bg: 'bg-cursedGold', glow: 'shadow-[0_0_10px_rgba(255,215,0,0.4)]', fill: 'bg-cursedGold' },
};

export function CapsuleStatBar({ label, value, max, type }: CapsuleStatBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const config = STAT_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="bg-surface rounded-full p-1 flex items-center gap-2 pr-4 h-10 border border-white/5 shadow-inner transition-all hover:border-white/10 group">
      <div className={`w-8 h-8 rounded-full ${config.bg} flex items-center justify-center ${config.glow} group-hover:scale-105 transition-transform`}>
        <Icon size={14} className="text-black" fill="currentColor" />
      </div>
      
      <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden relative border border-white/5">
        <motion.div
          className={`absolute inset-0 ${config.bg} ${config.fill} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 30 }}
        />
        
        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent h-[50%] pointer-events-none" />
      </div>

      <div className="flex flex-col items-end leading-none">
        <span className={`font-label text-[10px] font-bold ${config.color}`}>{Math.floor(percentage)}%</span>
        <span className="text-[7px] text-white/40 font-mono tracking-tighter">{value}/{max}</span>
      </div>
    </div>
  );
}
