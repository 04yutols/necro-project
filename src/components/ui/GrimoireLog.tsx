'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface GrimoireLogProps {
  logs: string[];
}

interface LogEntry {
  id: number;
  text: string;
  isCrit: boolean;
  isDamage: boolean;
  isVictory: boolean;
}

// Keep last N visible entries
const MAX_VISIBLE = 4;

export function GrimoireLog({ logs }: GrimoireLogProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    if (logs.length === 0) return;
    const last = logs[logs.length - 1];
    const id = ++counterRef.current;
    const isCrit = last.includes('!!') || last.includes('Critical') || last.includes('クリティカル');
    const isDamage = last.includes('ダメージ') || last.includes('dmg');
    const isVictory = last.includes('撃破') || last.includes('Victory');
    setEntries(prev => {
      const next = [...prev, { id, text: last, isCrit, isDamage, isVictory }];
      return next.slice(-MAX_VISIBLE);
    });
  }, [logs]);

  return (
    <div
      className="w-full h-full flex flex-col justify-end gap-[3px] overflow-hidden px-3 py-1"
      style={{ perspective: '600px' }}
    >
      <AnimatePresence mode="popLayout">
        {entries.map((entry, i) => {
          const opacity = 0.4 + (i / (MAX_VISIBLE - 1)) * 0.6;
          const scale = 0.92 + (i / (MAX_VISIBLE - 1)) * 0.08;
          const isLatest = i === entries.length - 1;

          return (
            <motion.div
              key={entry.id}
              layout
              initial={{
                opacity: 0,
                rotateX: -55,
                y: 8,
                scale: 0.9,
              }}
              animate={{
                opacity,
                rotateX: 0,
                y: 0,
                scale,
              }}
              exit={{
                opacity: 0,
                y: -20,
                scale: 0.88,
                transition: { duration: 0.35, ease: 'easeIn' },
              }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 22,
              }}
              style={{
                transformOrigin: 'top center',
                fontFamily: isLatest ? "'IM Fell English', serif" : 'inherit',
              }}
              className={`
                relative flex items-start gap-2 px-2.5 py-1 rounded-lg
                ${isLatest ? 'gothic-panel' : ''}
              `}
            >
              {/* Page edge accent */}
              {isLatest && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-[2px] rounded-l-lg"
                  style={{
                    background: entry.isCrit
                      ? 'linear-gradient(180deg, #FF00FF, #8B00FF)'
                      : entry.isVictory
                      ? 'linear-gradient(180deg, #00FF88, #00CC66)'
                      : 'linear-gradient(180deg, rgba(139,0,255,0.8), rgba(80,0,180,0.4))',
                    boxShadow: entry.isCrit
                      ? '0 0 8px rgba(255,0,255,0.8)'
                      : '0 0 6px rgba(139,0,255,0.5)',
                  }}
                />
              )}

              {/* Rune glyph */}
              <span
                className="text-[11px] shrink-0 mt-[1px]"
                style={{
                  color: entry.isCrit
                    ? '#FF00FF'
                    : entry.isVictory
                    ? '#00FF88'
                    : entry.isDamage
                    ? '#FF5555'
                    : 'rgba(139,0,255,0.7)',
                }}
              >
                {entry.isCrit ? '⚡' : entry.isVictory ? '☠️' : entry.isDamage ? '🩸' : '📜'}
              </span>

              <span
                className={`text-[10px] leading-snug flex-1 ${
                  entry.isCrit
                    ? 'font-black text-void-glow'
                    : entry.isVictory
                    ? 'font-bold text-green-400'
                    : entry.isDamage
                    ? 'font-semibold text-red-400'
                    : 'text-[#8A8AA8]'
                }`}
                style={
                  isLatest
                    ? { textShadow: entry.isCrit ? '0 0 12px rgba(188,0,251,0.9)' : undefined }
                    : undefined
                }
              >
                {entry.text.replace(/^📜\s*/, '')}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
