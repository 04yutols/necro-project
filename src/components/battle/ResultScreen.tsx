'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy, ArrowRight, Package, User } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore';
import { FuchsiaButton } from '../ui/FuchsiaButton';
import AppraisalCertificate from './AppraisalCertificate';

interface ResultScreenProps {
  isVictory: boolean;
  expGained: number;
  itemsGained: any[];
  monstersGained: string[];
  isPurplePillar?: boolean;
  onFinish: () => void;
}

export default function ResultScreen({ isVictory, expGained, itemsGained, monstersGained, onFinish }: ResultScreenProps) {
  const [showContent, setShowContent] = useState(false);
  const [selectedUniqueItem, setSelectedUniqueItem] = useState<any | null>(null);
  const { player, addExp } = useGameStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
      addExp(expGained);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-black p-4 font-serif relative overflow-hidden">
      {/* Texture Layer */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-dot-pattern" />

      {!showContent ? (
        <div className="text-primary animate-pulse tracking-[0.5em] text-xl uppercase">Calculating...</div>
      ) : (
        <div className="w-full max-w-sm border border-[#2C2C2C] bg-[#0D0D0D] p-6 animate-in fade-in zoom-in duration-700 relative z-10">
          <h1 className={`text-2xl font-bold text-center mb-6 tracking-[0.2em] uppercase
            ${isVictory ? 'text-secondary' : 'text-red-900'}
          `}>
            {isVictory ? 'Victory' : 'Defeat'}
          </h1>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-baseline border-b border-[#1A1A1A] pb-1">
              <span className="text-[10px] text-gray-500 uppercase font-sans font-bold">Exp Gained</span>
              <span className="text-lg text-primary font-mono">+{expGained}</span>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-gray-500 uppercase font-sans font-bold block mb-1">Spoils of War</span>
              <div className="flex flex-col gap-1">
                {[...itemsGained, ...monstersGained].length === 0 ? (
                  <span className="text-[10px] text-gray-700 italic">None</span>
                ) : (
                  [...itemsGained, ...monstersGained].map((drop, i) => {
                    const name = typeof drop === 'object' ? drop.name : drop;
                    const isUnique = typeof drop === 'object' && drop.rarity === 'HIDDEN_UNIQUE';
                    return (
                      <div key={i} className="flex justify-between items-center text-[11px] py-1 px-2 bg-black border border-[#1A1A1A]">
                        <span className={isUnique ? 'text-cursedGold font-bold' : 'text-gray-400'}>{name}</span>
                        {isUnique && (
                          <button 
                            onClick={() => setSelectedUniqueItem(drop)}
                            className="text-[8px] bg-secondary/10 text-secondary border border-secondary px-1 uppercase hover:bg-secondary/20 transition-colors"
                          >
                            Examine
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <button 
            onClick={onFinish}
            className="w-full py-3 bg-[#1A1A1A] border border-[#2C2C2C] text-gray-400 font-sans font-bold text-[10px] tracking-widest uppercase hover:bg-[#2C2C2C] hover:text-white transition-all"
          >
            Return to Citadel
          </button>
        </div>
      )}

      {selectedUniqueItem && (
        <AppraisalCertificate item={selectedUniqueItem} onClose={() => setSelectedUniqueItem(null)} />
      )}
    </div>
  );
}
