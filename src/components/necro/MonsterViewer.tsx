'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MonsterData } from '../../types/game';
import { LabPixiHandle } from './useNecroLabPixi';

interface MonsterViewerProps {
  monster: MonsterData | null;
  pixiHandle: LabPixiHandle | null;
  /** slot ref coords for soul-chain origin (center of viewer) */
  viewerRef: React.RefObject<HTMLDivElement | null>;
}

const MONSTER_EMOJI: Record<string, string> = {
  UNDEAD: '💀',
  DEMON: '😈',
  BEAST: '🐺',
  HUMANOID: '👹',
};

const TRIBE_COLORS: Record<string, string> = {
  UNDEAD: '#888EF7',
  DEMON: '#FF6B6B',
  BEAST: '#F9A825',
  HUMANOID: '#66BB6A',
};

type Phase = 'VISIBLE' | 'DISSOLVING' | 'REFORMING' | 'HIDDEN';

export function MonsterViewer({ monster, pixiHandle, viewerRef }: MonsterViewerProps) {
  const prevMonsterRef = useRef<MonsterData | null>(null);
  const [displayMonster, setDisplayMonster] = useState<MonsterData | null>(monster);
  const [phase, setPhase] = useState<Phase>('VISIBLE');

  useEffect(() => {
    if (monster?.id === prevMonsterRef.current?.id) return;

    if (prevMonsterRef.current && monster) {
      // Dissolve current → reform new
      setPhase('DISSOLVING');

      // Trigger smoke dissolve at viewer center
      if (pixiHandle && viewerRef.current) {
        const rect = viewerRef.current.getBoundingClientRect();
        // Coords in canvas space — pass element-center relative offset
        pixiHandle.spawnSmokeDissolve(200, 225); // approximate canvas center
      }

      setTimeout(() => {
        setPhase('HIDDEN');
        setDisplayMonster(monster);
        prevMonsterRef.current = monster;

        // Reform after brief pause
        setTimeout(() => {
          setPhase('REFORMING');
          if (pixiHandle) {
            pixiHandle.spawnSmokeReform(200, 225, () => {
              setPhase('VISIBLE');
            });
          } else {
            setTimeout(() => setPhase('VISIBLE'), 350);
          }
        }, 120);
      }, 380);
    } else {
      setDisplayMonster(monster);
      prevMonsterRef.current = monster;
      setPhase('VISIBLE');
    }
  }, [monster, pixiHandle, viewerRef]);

  const tribeColor = displayMonster ? (TRIBE_COLORS[displayMonster.tribe] || '#BC00FB') : '#BC00FB';
  const emoji = displayMonster ? (MONSTER_EMOJI[displayMonster.tribe] || '👾') : '';

  return (
    <div ref={viewerRef} className="relative flex flex-col items-center justify-center" style={{ height: '220px' }}>
      {/* Outer orbit ring */}
      <div
        className="absolute w-40 h-40 rounded-full pointer-events-none"
        style={{
          border: '1px solid rgba(139,0,255,0.2)',
          boxShadow: '0 0 30px rgba(139,0,255,0.08)',
          animation: 'magic-spin 12s linear infinite',
        }}
      />
      <div
        className="absolute w-28 h-28 rounded-full pointer-events-none"
        style={{
          border: '1px dashed rgba(139,0,255,0.15)',
          animation: 'magic-spin 8s linear infinite reverse',
        }}
      />

      <AnimatePresence mode="wait">
        {displayMonster && (phase === 'VISIBLE' || phase === 'REFORMING') && (
          <motion.div
            key={displayMonster.id + '-sprite'}
            initial={phase === 'REFORMING'
              ? { scale: 0, opacity: 0, filter: 'blur(12px)' }
              : { scale: 1, opacity: 1 }
            }
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 1.3, opacity: 0, filter: 'blur(10px)', transition: { duration: 0.35 } }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="relative flex flex-col items-center"
          >
            {/* Float + breathe wrapper */}
            <motion.div
              animate={{
                y: [-6, 6, -6],
                scaleX: [1, 1.04, 1],
                scaleY: [1, 0.97, 1],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative"
            >
              {/* Glow aura */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${tribeColor}33 0%, transparent 70%)`,
                  transform: 'scale(1.8)',
                  filter: 'blur(12px)',
                }}
              />

              {/* Monster sprite frame */}
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl relative overflow-hidden"
                style={{
                  background: `radial-gradient(circle at 40% 30%, ${tribeColor}22, rgba(0,0,0,0.85))`,
                  border: `1.5px solid ${tribeColor}55`,
                  boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 20px ${tribeColor}22, inset 0 0 20px rgba(0,0,0,0.5)`,
                }}
              >
                {/* Scan line overlay */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.015) 4px)',
                  }}
                />
                {/* Specular */}
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)',
                    borderRadius: 'inherit',
                  }}
                />
                <span style={{ filter: `drop-shadow(0 0 8px ${tribeColor})` }}>{emoji}</span>
              </div>

              {/* Shadow under sprite */}
              <motion.div
                animate={{ scaleX: [1, 1.15, 1], opacity: [0.3, 0.15, 0.3] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                className="mx-auto mt-2 rounded-full"
                style={{ width: 64, height: 10, background: `radial-gradient(ellipse, ${tribeColor}66, transparent)`, filter: 'blur(4px)' }}
              />
            </motion.div>

            {/* Monster name */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-3 flex flex-col items-center gap-1"
            >
              <span
                className="text-base font-cinzel font-black tracking-wider"
                style={{
                  color: '#E8E0FF',
                  fontFamily: "'Cinzel Decorative', serif",
                  textShadow: `0 0 12px ${tribeColor}88`,
                }}
              >
                {displayMonster.name}
              </span>
              <span
                className="text-[9px] font-black tracking-[0.3em] uppercase px-2 py-0.5 rounded-full"
                style={{
                  color: tribeColor,
                  border: `1px solid ${tribeColor}44`,
                  background: `${tribeColor}11`,
                }}
              >
                {displayMonster.tribe} · COST {displayMonster.cost}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Placeholder when no monster */}
      {!displayMonster && (
        <div className="flex flex-col items-center gap-2 opacity-25">
          <div className="w-20 h-20 rounded-3xl border border-dashed border-[rgba(139,0,255,0.4)] flex items-center justify-center text-3xl">
            ?
          </div>
          <span className="text-[10px] tracking-widest" style={{ color: 'rgba(139,0,255,0.5)', fontFamily: 'monospace' }}>
            SELECT SPIRIT
          </span>
        </div>
      )}
    </div>
  );
}
