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
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
      className={`relative w-full h-[72px] rounded-capsule border-2 flex items-center px-3 overflow-hidden group transition-colors focus:outline-none
        ${monster ? 'border-secondary bg-secondary/10 shadow-[0_0_15px_rgba(0,255,171,0.2)]' : 'border-dashed border-gray-700 bg-black/40 hover:border-secondary/50'}
      `}
      onClick={onClick}
    >
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-white/20 bg-black/80 flex items-center justify-center font-bold text-xs text-gray-400 font-space shadow-inner z-10">
        0{index + 1}
      </div>
      
      <div className="ml-[3.5rem] flex-1 flex flex-col items-start justify-center overflow-hidden z-10">
        {monster ? (
          <>
            <div className="font-bold text-white text-sm whitespace-nowrap overflow-hidden text-ellipsis w-full text-left font-noto drop-shadow-md">
              {monster.name}
            </div>
            <div className="flex gap-2 text-[10px] text-secondary font-mono mt-0.5 drop-shadow-[0_0_5px_rgba(0,255,171,0.8)]">
              <span>C:{monster.cost}</span>
              <span>A:{monster.stats.atk}</span>
            </div>
          </>
        ) : (
          <span className="text-gray-600 font-bold tracking-widest text-[10px] uppercase font-space">Empty Slot</span>
        )}
      </div>

      {/* Shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

      {monster && monster.equippedShardId && (
        <div className="absolute right-3 text-primary animate-pulse drop-shadow-[0_0_8px_rgba(224,141,255,0.8)] z-10">
          <Sparkles size={16} />
        </div>
      )}

      {/* Hover Actions */}
      {monster && onEquipClick && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-black/80 rounded-full p-1 border border-secondary/50 z-20">
           <div 
             onClick={(e) => { e.stopPropagation(); onEquipClick(); }} 
             className="text-gray-400 hover:text-secondary p-1 rounded-full bg-dark"
           >
             <Shield size={14} />
           </div>
        </div>
      )}
    </motion.button>
  );
}
