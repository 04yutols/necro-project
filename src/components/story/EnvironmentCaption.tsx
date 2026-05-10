'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { StoryScene } from '../../types/story';

const DISPLAY_MS = 2500;

interface Props {
  scene: StoryScene;
  onDone: () => void;
}

export function EnvironmentCaption({ scene, onDone }: Props) {
  const text = scene.lines[0]?.text ?? '';

  useEffect(() => {
    const timer = setTimeout(onDone, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [scene.id]);

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onClick={onDone}
      style={{
        position: 'fixed',
        top: 'max(20px, env(safe-area-inset-top, 20px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10000,
        width: '78vw',
        maxWidth: 400,
        background: 'rgba(4,2,14,0.82)',
        border: '1px solid rgba(139,0,255,0.25)',
        backdropFilter: 'blur(10px)',
        borderRadius: 4,
        padding: '12px 16px',
        cursor: 'pointer',
      }}
    >
      <p
        style={{
          fontFamily: "'Noto Sans JP', sans-serif",
          fontSize: 12,
          color: 'rgba(200,190,230,0.88)',
          lineHeight: 1.85,
          whiteSpace: 'pre-wrap',
          margin: 0,
        }}
      >
        {text}
      </p>
    </motion.div>
  );
}
