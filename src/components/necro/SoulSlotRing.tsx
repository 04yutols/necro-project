'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { SoulShardData } from '../../types/game';
import { Sparkles, Plus } from 'lucide-react';

interface SoulSlotRingProps {
  /** Up to 3 slot entries */
  slots: (SoulShardData | null)[];
  onSlotTap: (slotIndex: number) => void;
  /** Refs for each slot so parent can compute canvas coords for soul-chain */
  slotRefs: React.RefObject<HTMLDivElement | null>[];
  activeSlot: number | null;
}

const SLOT_ANGLES = [-52, 0, 52]; // degrees from bottom-center
const SLOT_RADIUS = 88; // px from center

export function SoulSlotRing({ slots, onSlotTap, slotRefs, activeSlot }: SoulSlotRingProps) {
  return (
    <div className="relative w-full" style={{ height: '100px' }}>
      {SLOT_ANGLES.map((angleDeg, i) => {
        const angleRad = (angleDeg - 90) * (Math.PI / 180);
        // Slight arc below the monster viewer
        const x = Math.cos(angleRad) * SLOT_RADIUS;
        const y = Math.sin(angleRad) * SLOT_RADIUS + 10;
        const shard = slots[i];
        const isActive = activeSlot === i;

        return (
          <motion.div
            key={i}
            ref={slotRefs[i]}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.08 }}
            className="absolute"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
            }}
          >
            <motion.button
              onClick={() => onSlotTap(i)}
              whileTap={{ scale: 0.88 }}
              animate={isActive
                ? { boxShadow: ['0 0 8px rgba(188,0,251,0.4)', '0 0 22px rgba(188,0,251,0.9)', '0 0 8px rgba(188,0,251,0.4)'] }
                : {}
              }
              transition={{ duration: 1.2, repeat: Infinity }}
              className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
              style={{
                background: shard
                  ? 'linear-gradient(135deg, rgba(80,0,180,0.55), rgba(30,0,80,0.8))'
                  : 'rgba(8,4,18,0.75)',
                border: `1px solid ${isActive ? 'rgba(188,0,251,0.9)' : shard ? 'rgba(139,0,255,0.55)' : 'rgba(80,40,120,0.4)'}`,
                boxShadow: shard
                  ? '0 0 14px rgba(139,0,255,0.4), inset 0 0 12px rgba(0,0,0,0.5)'
                  : 'inset 0 0 12px rgba(0,0,0,0.6)',
              }}
            >
              {/* Specular highlight */}
              <div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 55%)' }}
              />

              {shard ? (
                <>
                  <Sparkles size={14} style={{ color: '#D580FF' }} />
                  <span
                    className="text-[7px] font-black leading-none mt-0.5 truncate max-w-[40px] text-center px-0.5"
                    style={{ color: '#C8B0FF', fontFamily: 'monospace' }}
                  >
                    {shard.originMonsterName}
                  </span>
                  {/* Equipped glow ring */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ border: '1px solid rgba(188,0,251,0.6)', boxShadow: 'inset 0 0 8px rgba(139,0,255,0.3)' }}
                  />
                </>
              ) : (
                <>
                  <Plus size={12} style={{ color: 'rgba(139,0,255,0.55)' }} strokeWidth={2.5} />
                  <span
                    className="text-[7px] font-black leading-none mt-0.5"
                    style={{ color: 'rgba(139,0,255,0.4)', fontFamily: 'monospace' }}
                  >
                    SLOT
                  </span>
                </>
              )}
            </motion.button>

            {/* Tether line back toward center */}
            <svg
              className="absolute pointer-events-none"
              style={{
                left: '50%',
                top: '50%',
                width: SLOT_RADIUS,
                height: SLOT_RADIUS,
                transform: `translate(-50%, -50%)`,
                overflow: 'visible',
              }}
            >
              <line
                x1={0} y1={0}
                x2={-x * 0.4} y2={-y * 0.4}
                stroke={shard ? 'rgba(188,0,251,0.3)' : 'rgba(80,40,120,0.15)'}
                strokeWidth={shard ? 1 : 0.8}
                strokeDasharray={shard ? 'none' : '2 4'}
              />
            </svg>
          </motion.div>
        );
      })}
    </div>
  );
}
