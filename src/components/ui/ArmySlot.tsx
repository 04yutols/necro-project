import React from 'react';
import { motion } from 'framer-motion';
import { MonsterData } from '../../types/game';
import { Sparkles, Shield } from 'lucide-react';

interface ArmySlotProps {
  monster: MonsterData | null;
  index: number;
  onClick: () => void;
  onEquipClick?: () => void;
}

export function ArmySlot({ monster, index, onClick, onEquipClick }: ArmySlotProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, x: 5 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      className={`relative w-full h-[80px] rounded-2xl border-4 flex items-center px-4 overflow-hidden group transition-all focus:outline-none shadow-lg
        ${monster 
          ? 'border-secondary bg-secondary/10 shadow-[0_0_20px_rgba(0,255,171,0.2)]' 
          : 'border-white/5 border-dashed bg-black/40 hover:border-secondary/40'}
      `}
      onClick={onClick}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded-xl border-2 border-white/20 bg-black/80 flex items-center justify-center font-black text-sm text-secondary font-space shadow-inner z-10">
        {index + 1}
      </div>
      
      <div className="ml-4 flex-1 flex flex-col items-start justify-center overflow-hidden z-10">
        {monster ? (
          <>
            <div className="font-black text-white text-sm whitespace-nowrap overflow-hidden text-ellipsis w-full text-left font-space tracking-tight drop-shadow-md">
              {monster.name.toUpperCase()}
            </div>
            <div className="flex gap-3 text-[10px] text-secondary font-black font-space mt-1 uppercase tracking-widest opacity-80">
              <span className="bg-black/40 px-1.5 py-0.5 rounded">COST:{monster.cost}</span>
              <span className="bg-black/40 px-1.5 py-0.5 rounded">ATK:{monster.stats.atk}</span>
            </div>
          </>
        ) : (
          <span className="text-gray-600 font-black tracking-[0.2em] text-[10px] uppercase font-space opacity-50">Empty Slot</span>
        )}
      </div>

      {/* Shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

      {monster && monster.equippedShardId && (
        <div className="absolute right-4 text-primary animate-bounce drop-shadow-[0_0_12px_rgba(224,141,255,0.8)] z-10">
          <Sparkles size={18} />
        </div>
      )}

      {/* Hover Actions */}
      {monster && onEquipClick && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 flex gap-1 bg-black/90 rounded-xl p-1.5 border-2 border-secondary/50 z-20 shadow-2xl">
           <div 
             onClick={(e) => { e.stopPropagation(); onEquipClick(); }} 
             className="text-white hover:text-secondary p-1 rounded-lg bg-dark transition-colors"
           >
             <Shield size={16} />
           </div>
        </div>
      )}
    </motion.button>
  );
}
